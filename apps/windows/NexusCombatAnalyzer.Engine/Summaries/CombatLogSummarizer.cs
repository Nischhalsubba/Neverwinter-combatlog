using System.Text;
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
            if (outcome.Event.Classification != EventClassification.Damage || outcome.Event.Magnitude <= 0)
            {
                continue;
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

        return new CombatLogSummary(
            path,
            linesRead,
            parsedLines,
            failedLines,
            playerRows.Sum(row => row.Damage),
            companionRows.Sum(row => row.Damage),
            playerRows,
            companionRows);
    }

    private static bool IsCompanion(ParsedEvent parsedEvent)
    {
        if (string.IsNullOrWhiteSpace(parsedEvent.OwnerRef) || string.Equals(parsedEvent.OwnerRef, parsedEvent.SourceRef, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return parsedEvent.SourceRef.StartsWith("C[", StringComparison.OrdinalIgnoreCase)
            || parsedEvent.SourceName.Contains("companion", StringComparison.OrdinalIgnoreCase)
            || parsedEvent.SourceName.Contains("summon", StringComparison.OrdinalIgnoreCase);
    }

    private static string StableKey(string name, string reference) =>
        string.IsNullOrWhiteSpace(reference) ? name : reference;

    private sealed class MutableDamageRow
    {
        private readonly Dictionary<string, double> _powerDamage = new(StringComparer.OrdinalIgnoreCase);

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
        }

        public DamageRow ToImmutable()
        {
            var topPower = _powerDamage.Count == 0
                ? "Unknown"
                : _powerDamage.OrderByDescending(pair => pair.Value).First().Key;

            return new DamageRow(Name, Reference, OwnerName, Damage, Hits, CriticalHits, topPower);
        }
    }
}
