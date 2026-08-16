using System.Text;
using System.Globalization;
using NexusCombatAnalyzer.Engine.Models;
using NexusCombatAnalyzer.Engine.Parsing;

namespace NexusCombatAnalyzer.Engine.Summaries;

public sealed class CombatLogSummarizer
{
    private readonly NeverwinterLogParser _parser = new();

    public CombatLogSummary SummarizeFile(string path, long startByteOffset = 0)
    {
        using var stream = File.Open(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        if (startByteOffset > 0 && startByteOffset < stream.Length)
        {
            stream.Seek(startByteOffset, SeekOrigin.Begin);
        }

        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: false);

        var players = new Dictionary<string, MutableDamageRow>(StringComparer.OrdinalIgnoreCase);
        var companions = new Dictionary<string, MutableDamageRow>(StringComparer.OrdinalIgnoreCase);
        long linesRead = 0;
        long parsedLines = 0;
        long failedLines = 0;
        var byteOffset = stream.Position;
        DateTime? firstDamageAt = null;
        DateTime? lastDamageAt = null;

        while (reader.ReadLine() is { } line)
        {
            var raw = new RawLogLine(0, linesRead, byteOffset, line);
            var outcome = _parser.Parse(raw);
            linesRead++;
            byteOffset += Encoding.UTF8.GetByteCount(line) + Environment.NewLine.Length;

            if (!outcome.IsSuccess || outcome.Event is null)
            {
                failedLines++;
                continue;
            }

            parsedLines++;
            if (!IsCanonicalPublishedDamage(outcome.Event))
            {
                continue;
            }

            if (TryParseNeverwinterTimestamp(outcome.Event.RawTimestamp, out var damageAt))
            {
                firstDamageAt ??= damageAt;
                lastDamageAt = damageAt;
            }

            var isCompanion = IsCompanion(outcome.Event);
            var key = isCompanion
                ? StableKey(outcome.Event.SourceName, outcome.Event.SourceRef)
                : StableKey(outcome.Event.OwnerName, outcome.Event.OwnerRef);

            var bucket = isCompanion ? companions : players;
            if (!bucket.TryGetValue(key, out var row))
            {
                row = new MutableDamageRow(
                    isCompanion ? outcome.Event.SourceName : outcome.Event.OwnerName,
                    isCompanion ? outcome.Event.SourceRef : outcome.Event.OwnerRef,
                    isCompanion ? outcome.Event.OwnerName : null);
                bucket[key] = row;
            }

            row.Add(outcome.Event);
        }

        var playerRows = players.Values.Select(row => row.ToImmutable()).OrderByDescending(row => row.Damage).ToArray();
        var companionRows = companions.Values.Select(row => row.ToImmutable()).OrderByDescending(row => row.Damage).ToArray();
        var durationSeconds = CalculateDurationSeconds(firstDamageAt, lastDamageAt);
        var totalDamage = playerRows.Sum(row => row.Damage) + companionRows.Sum(row => row.Damage);

        return new CombatLogSummary(
            path,
            linesRead,
            parsedLines,
            failedLines,
            durationSeconds,
            durationSeconds > 0 ? totalDamage / durationSeconds : totalDamage,
            playerRows.Sum(row => row.Damage),
            companionRows.Sum(row => row.Damage),
            ApplyEncounterDuration(playerRows, durationSeconds),
            ApplyEncounterDuration(companionRows, durationSeconds));
    }

    private static IReadOnlyList<DamageRow> ApplyEncounterDuration(IReadOnlyList<DamageRow> rows, double durationSeconds) =>
        rows.Select(row => row with
        {
            DurationSeconds = durationSeconds,
            EncDps = durationSeconds > 0 ? row.Damage / durationSeconds : row.Damage
        }).ToArray();

    private static double CalculateDurationSeconds(DateTime? firstDamageAt, DateTime? lastDamageAt)
    {
        if (firstDamageAt is null || lastDamageAt is null)
        {
            return 0;
        }

        var seconds = (lastDamageAt.Value - firstDamageAt.Value).TotalSeconds;
        return seconds <= 0 ? 1 : seconds;
    }

    private static bool IsCanonicalPublishedDamage(ParsedEvent parsedEvent)
    {
        if (parsedEvent.Classification != EventClassification.Damage || parsedEvent.Magnitude <= 0)
        {
            return false;
        }

        if (!string.Equals(parsedEvent.EventType, "Physical", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (!parsedEvent.OwnerRef.StartsWith("P[", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return !parsedEvent.Flags.Any(flag =>
            string.Equals(flag, "Immune", StringComparison.OrdinalIgnoreCase)
            || string.Equals(flag, "ShowPowerDisplayName", StringComparison.OrdinalIgnoreCase));
    }

    private static bool TryParseNeverwinterTimestamp(string rawTimestamp, out DateTime timestamp)
    {
        return DateTime.TryParseExact(
            rawTimestamp,
            ["yy:MM:dd:HH:mm:ss.FFFFFFF", "yy:MM:dd:HH:mm:ss"],
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeLocal,
            out timestamp);
    }

    private static bool IsCompanion(ParsedEvent parsedEvent)
    {
        if (string.IsNullOrWhiteSpace(parsedEvent.OwnerRef)
            || !parsedEvent.OwnerRef.StartsWith("P[", StringComparison.OrdinalIgnoreCase)
            || string.Equals(parsedEvent.OwnerRef, parsedEvent.SourceRef, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var sourceRef = parsedEvent.SourceRef.ToLowerInvariant();
        var sourceName = parsedEvent.SourceName.ToLowerInvariant();
        return sourceRef.Contains("pet_", StringComparison.Ordinal)
            || sourceRef.Contains("companion", StringComparison.Ordinal)
            || sourceRef.Contains("appointment", StringComparison.Ordinal)
            || sourceRef.Contains("summon", StringComparison.Ordinal)
            || sourceName.Contains("companion", StringComparison.Ordinal)
            || sourceName.Contains("pet", StringComparison.Ordinal)
            || sourceName.Contains("appointment", StringComparison.Ordinal)
            || sourceName.Contains("summon", StringComparison.Ordinal);
    }

    private static string StableKey(string name, string reference) =>
        string.IsNullOrWhiteSpace(reference) ? name : reference;

    private sealed class MutableDamageRow
    {
        private readonly Dictionary<string, double> _powerDamage = new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, int> _powerHits = new(StringComparer.OrdinalIgnoreCase);
        private readonly List<double> _damageTrend = [];

        public MutableDamageRow(string name, string reference, string? ownerName)
        {
            Name = name;
            Reference = reference;
            OwnerName = ownerName;
        }

        public string Name { get; }
        public string Reference { get; }
        public string? OwnerName { get; }
        public double Damage { get; private set; }
        public int Hits { get; private set; }
        public int CriticalHits { get; private set; }

        public void Add(ParsedEvent parsedEvent)
        {
            Damage += parsedEvent.Magnitude;
            Hits++;
            if (parsedEvent.IsCritical)
            {
                CriticalHits++;
            }

            _powerDamage[parsedEvent.PowerName] = _powerDamage.GetValueOrDefault(parsedEvent.PowerName) + parsedEvent.Magnitude;
            _powerHits[parsedEvent.PowerName] = _powerHits.GetValueOrDefault(parsedEvent.PowerName) + 1;
            _damageTrend.Add(parsedEvent.Magnitude);
        }

        public DamageRow ToImmutable()
        {
            var powerBreakdown = _powerDamage
                .Select(pair => new PowerDamageRow(pair.Key, pair.Value, _powerHits.GetValueOrDefault(pair.Key)))
                .OrderByDescending(row => row.TotalDamage)
                .ToArray();

            var topPower = powerBreakdown.Length == 0
                ? "Unknown"
                : powerBreakdown[0].PowerName;

            return new DamageRow(Name, Reference, OwnerName, Damage, 0, 0, Hits, CriticalHits, topPower, powerBreakdown, BuildTrend());
        }

        private IReadOnlyList<double> BuildTrend()
        {
            if (_damageTrend.Count <= 24)
            {
                return _damageTrend.ToArray();
            }

            var bucketSize = (int)Math.Ceiling(_damageTrend.Count / 24d);
            return _damageTrend
                .Select((value, index) => new { Value = value, Bucket = index / bucketSize })
                .GroupBy(item => item.Bucket)
                .Select(group => group.Sum(item => item.Value))
                .ToArray();
        }
    }
}