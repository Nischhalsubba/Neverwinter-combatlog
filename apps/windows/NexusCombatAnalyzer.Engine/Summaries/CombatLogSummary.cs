namespace NexusCombatAnalyzer.Engine.Summaries;

public sealed record CombatLogSummary(
    string SourcePath,
    long LinesRead,
    long ParsedLines,
    long FailedLines,
    double DurationSeconds,
    double EncDps,
    double TotalPlayerDamage,
    double TotalCompanionDamage,
    IReadOnlyList<DamageRow> Players,
    IReadOnlyList<DamageRow> Companions);
