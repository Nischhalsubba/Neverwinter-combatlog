namespace NexusCombatAnalyzer.Engine.Models;

public sealed record ParseFailure(
    RawLogLine Raw,
    string ErrorCode,
    string Message,
    string? RawTimestamp,
    IReadOnlyList<string> OriginalTokens);
