namespace NexusCombatAnalyzer.Engine.Models;

public sealed record RawLogLine(
    long SourceFileId,
    long LineIndex,
    long ByteOffset,
    string Text);
