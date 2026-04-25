using NexusCombatAnalyzer.Engine.Models;
using NexusCombatAnalyzer.Engine.Parsing;

var tests = new List<(string Name, Action Test)>
{
    ("parses exact Neverwinter payload", ParsesExactNeverwinterPayload),
    ("tokenizes quoted commas", TokenizesQuotedCommas),
    ("retains malformed missing timestamp line", RetainsMalformedMissingTimestampLine),
    ("parses scientific notation", ParsesScientificNotation),
    ("classifies positive magnitude as damage", ClassifiesPositiveMagnitudeAsDamage),
    ("recovers simple unquoted comma in owner name", RecoversUnquotedCommaInOwnerName)
};

foreach (var (name, test) in tests)
{
    test();
    Console.WriteLine($"PASS {name}");
}

Console.WriteLine($"All {tests.Count} parser tests passed.");

static void ParsesExactNeverwinterPayload()
{
    var parsed = Parse("24:04:25:12:00:00.0::Ar-chew,P[123],Ar-chew,P[123],Target Dummy,C[1],Aimed Shot,Pow[77],Damage,Critical|Physical,12345,12345");

    AssertEqual("Ar-chew", parsed.OwnerName);
    AssertEqual("P[123]", parsed.OwnerRef);
    AssertEqual("Ar-chew", parsed.SourceName);
    AssertEqual("Target Dummy", parsed.TargetName);
    AssertEqual("Aimed Shot", parsed.PowerName);
    AssertEqual(12345d, parsed.Magnitude);
    AssertTrue(parsed.IsCritical, "critical flag should be detected");
}

static void TokenizesQuotedCommas()
{
    var tokens = NeverwinterLogParser.Tokenize("\"Owner, With Comma\",P[1],Source,P[1],Target,C[2],Power,Pow[3],Damage,,1,1");
    AssertEqual("Owner, With Comma", tokens[0]);
    AssertEqual(12, tokens.Count);
}

static void RetainsMalformedMissingTimestampLine()
{
    var parser = new NeverwinterLogParser();
    var outcome = parser.Parse(new RawLogLine(0, 0, 0, "not a neverwinter payload"));

    AssertTrue(!outcome.IsSuccess, "malformed line should fail");
    AssertEqual("missing_timestamp_separator", outcome.Failure?.ErrorCode);
}

static void ParsesScientificNotation()
{
    var parsed = Parse("24:04:25:12:00:01.0::Ar-chew,P[123],Ar-chew,P[123],Target Dummy,C[1],Aimed Shot,Pow[77],Damage,,1.25E+4,1.25E+4");

    AssertEqual(12500d, parsed.Magnitude);
}

static void ClassifiesPositiveMagnitudeAsDamage()
{
    var parsed = Parse("24:04:25:12:00:02.0::Ar-chew,P[123],Ar-chew,P[123],Target Dummy,C[1],Aimed Shot,Pow[77],Damage,,10,10");

    AssertEqual(EventClassification.Damage, parsed.Classification);
}

static void RecoversUnquotedCommaInOwnerName()
{
    var parsed = Parse("24:04:25:12:00:03.0::Owner, With Comma,P[1],Owner, With Comma,P[1],Target,C[2],Power,Pow[3],Damage,,10,10");

    AssertEqual("Owner, With Comma", parsed.OwnerName);
}

static ParsedEvent Parse(string line)
{
    var parser = new NeverwinterLogParser();
    var outcome = parser.Parse(new RawLogLine(0, 0, 0, line));

    if (!outcome.IsSuccess || outcome.Event is null)
    {
        throw new InvalidOperationException($"Parse failed: {outcome.Failure?.ErrorCode} {outcome.Failure?.Message}");
    }

    return outcome.Event;
}

static void AssertEqual<T>(T expected, T actual)
{
    if (!EqualityComparer<T>.Default.Equals(expected, actual))
    {
        throw new InvalidOperationException($"Expected '{expected}', got '{actual}'.");
    }
}

static void AssertTrue(bool condition, string message)
{
    if (!condition)
    {
        throw new InvalidOperationException(message);
    }
}
