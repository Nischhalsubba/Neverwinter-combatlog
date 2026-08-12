using System.Globalization;
using NexusCombatAnalyzer.Engine.Models;

namespace NexusCombatAnalyzer.Engine.Parsing;

public sealed class NeverwinterLogParser
{
    private const int PayloadFieldCount = 12;

    public ParseOutcome Parse(RawLogLine raw)
    {
        if (string.IsNullOrWhiteSpace(raw.Text))
        {
            return Failure(raw, "empty_line", "Line is empty.", null, Array.Empty<string>());
        }

        var separatorIndex = raw.Text.IndexOf("::", StringComparison.Ordinal);
        if (separatorIndex < 0)
        {
            return Failure(raw, "missing_timestamp_separator", "Line does not contain the Neverwinter timestamp separator.", null, Array.Empty<string>());
        }

        var rawTimestamp = raw.Text[..separatorIndex].Trim();
        var payload = raw.Text[(separatorIndex + 2)..].Trim();
        var tokens = Tokenize(payload);
        tokens = RecoverLegacyUnquotedCommas(tokens);

        if (tokens.Count != PayloadFieldCount)
        {
            return Failure(raw, "invalid_field_count", $"Expected {PayloadFieldCount} payload fields, found {tokens.Count}.", rawTimestamp, tokens);
        }

        if (!TryParseNumber(tokens[10], out var magnitude))
        {
            return Failure(raw, "invalid_magnitude", $"Magnitude '{tokens[10]}' is not numeric.", rawTimestamp, tokens);
        }

        if (!TryParseNumber(tokens[11], out var baseMagnitude))
        {
            return Failure(raw, "invalid_base_magnitude", $"Base magnitude '{tokens[11]}' is not numeric.", rawTimestamp, tokens);
        }

        var flags = tokens[9]
            .Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToArray();

        var parsed = new ParsedEvent(
            raw,
            rawTimestamp,
            tokens[0],
            tokens[1],
            tokens[2],
            tokens[3],
            tokens[4],
            tokens[5],
            tokens[6],
            tokens[7],
            tokens[8],
            flags,
            magnitude,
            baseMagnitude,
            Classify(tokens[8], tokens[9], magnitude),
            tokens);

        return ParseOutcome.Success(parsed);
    }

    public static IReadOnlyList<string> Tokenize(string payload)
    {
        var tokens = new List<string>();
        var current = new List<char>();
        var inQuotes = false;

        for (var i = 0; i < payload.Length; i++)
        {
            var character = payload[i];
            if (character == '"')
            {
                if (inQuotes && i + 1 < payload.Length && payload[i + 1] == '"')
                {
                    current.Add('"');
                    i++;
                    continue;
                }

                inQuotes = !inQuotes;
                continue;
            }

            if (character == ',' && !inQuotes)
            {
                tokens.Add(new string(current.ToArray()).Trim());
                current.Clear();
                continue;
            }

            current.Add(character);
        }

        tokens.Add(new string(current.ToArray()).Trim());
        return tokens;
    }

    private static IReadOnlyList<string> RecoverLegacyUnquotedCommas(IReadOnlyList<string> tokens)
    {
        if (tokens.Count <= PayloadFieldCount)
        {
            return tokens;
        }

        var overflow = tokens.Count - PayloadFieldCount;
        var recovered = tokens.ToList();

        // Legacy ACT tolerated unquoted commas inside names. The first six fields are
        // owner/source/target names and refs, so merge extra comma fragments there first.
        for (var index = 0; index <= 4 && overflow > 0 && index + 1 < recovered.Count; index += 2)
        {
            recovered[index] = $"{recovered[index]}, {recovered[index + 1]}";
            recovered.RemoveAt(index + 1);
            overflow--;
        }

        return recovered;
    }

    private static bool TryParseNumber(string value, out double number) =>
        double.TryParse(value, NumberStyles.Float | NumberStyles.AllowThousands, CultureInfo.InvariantCulture, out number);

    private static EventClassification Classify(string eventType, string flags, double magnitude)
    {
        var normalizedType = eventType.Trim().ToLowerInvariant();
        var normalizedFlags = flags.Trim().ToLowerInvariant();

        if (normalizedType.Contains("heal", StringComparison.Ordinal)
            || normalizedFlags.Contains("heal", StringComparison.Ordinal)
            || (normalizedType == "hitpoints" && magnitude < 0))
        {
            return EventClassification.Healing;
        }

        if (normalizedType == "shield" || normalizedFlags.Contains("shield", StringComparison.Ordinal))
        {
            return normalizedFlags.Contains("break", StringComparison.Ordinal)
                ? EventClassification.ShieldBreak
                : EventClassification.ShieldDamage;
        }

        if (normalizedFlags.Contains("immune", StringComparison.Ordinal))
        {
            return EventClassification.Immune;
        }

        if (normalizedType == "power"
            || normalizedType.Contains("resource", StringComparison.Ordinal)
            || normalizedFlags.Contains("resource", StringComparison.Ordinal))
        {
            return EventClassification.Resource;
        }

        if (normalizedType == "triggercomplex")
        {
            return EventClassification.Meta;
        }

        if (normalizedType.Contains("summon", StringComparison.Ordinal) || normalizedFlags.Contains("summon", StringComparison.Ordinal))
        {
            return EventClassification.Summon;
        }

        if (normalizedType.Contains("control", StringComparison.Ordinal) || normalizedFlags.Contains("control", StringComparison.Ordinal))
        {
            return EventClassification.Control;
        }

        if (magnitude > 0 && IsDamageType(normalizedType))
        {
            return EventClassification.Damage;
        }

        return EventClassification.Unknown;
    }

    private static bool IsDamageType(string normalizedType) =>
        normalizedType is "physical"
            or "arcane"
            or "cold"
            or "fire"
            or "lightning"
            or "necrotic"
            or "poison"
            or "psychic"
            or "radiant"
            or "thunder"
            or "force"
            or "untyped";

    private static ParseOutcome Failure(RawLogLine raw, string code, string message, string? rawTimestamp, IReadOnlyList<string> tokens) =>
        ParseOutcome.Failed(new ParseFailure(raw, code, message, rawTimestamp, tokens));
}
