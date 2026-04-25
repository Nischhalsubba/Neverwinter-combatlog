namespace NexusCombatAnalyzer.Engine.Models;

public sealed record ParseOutcome(ParsedEvent? Event, ParseFailure? Failure)
{
    public bool IsSuccess => Event is not null;

    public static ParseOutcome Success(ParsedEvent parsedEvent) => new(parsedEvent, null);

    public static ParseOutcome Failed(ParseFailure failure) => new(null, failure);
}
