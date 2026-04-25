namespace NexusCombatAnalyzer.Engine.Models;

public sealed record ParsedEvent(
    RawLogLine Raw,
    string RawTimestamp,
    string OwnerName,
    string OwnerRef,
    string SourceName,
    string SourceRef,
    string TargetName,
    string TargetRef,
    string PowerName,
    string PowerRef,
    string EventType,
    IReadOnlyList<string> Flags,
    double Magnitude,
    double BaseMagnitude,
    EventClassification Classification,
    IReadOnlyList<string> OriginalTokens)
{
    public bool IsCritical => Flags.Any(flag => string.Equals(flag, "Critical", StringComparison.OrdinalIgnoreCase));
}
