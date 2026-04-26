using NexusCombatAnalyzer.Engine.Models;
using NexusCombatAnalyzer.Engine.Parsing;
using NexusCombatAnalyzer.Engine.Summaries;

if (args.Length == 2 && args[0] == "--summarize")
{
    var summary = new CombatLogSummarizer().SummarizeFile(args[1]);
    Console.WriteLine($"File: {summary.SourcePath}");
    Console.WriteLine($"Lines: {summary.LinesRead:N0}");
    Console.WriteLine($"Parsed: {summary.ParsedLines:N0}");
    Console.WriteLine($"Failed: {summary.FailedLines:N0}");
    Console.WriteLine($"Player damage: {summary.TotalPlayerDamage:N0}");
    Console.WriteLine($"Companion damage: {summary.TotalCompanionDamage:N0}");
    Console.WriteLine("Top players:");
    foreach (var row in summary.Players.Take(5))
    {
        Console.WriteLine($"- {row.Name}: {row.Damage:N0} damage, {row.Hits:N0} hits, top power {row.TopPower}");
    }
    Console.WriteLine("Top companions:");
    foreach (var row in summary.Companions.Take(5))
    {
        Console.WriteLine($"- {row.Name} ({row.OwnerName ?? "unknown owner"}): {row.Damage:N0} damage, {row.Hits:N0} hits, top power {row.TopPower}");
    }
    return;
}

var tests = new List<(string Name, Action Test)>
{
    ("parses exact Neverwinter payload", ParsesExactNeverwinterPayload),
    ("tokenizes quoted commas", TokenizesQuotedCommas),
    ("retains malformed missing timestamp line", RetainsMalformedMissingTimestampLine),
    ("parses scientific notation", ParsesScientificNotation),
    ("classifies positive magnitude as damage", ClassifiesPositiveMagnitudeAsDamage),
    ("does not count power/resource rows as damage", DoesNotCountPowerResourceRowsAsDamage),
    ("recovers simple unquoted comma in owner name", RecoversUnquotedCommaInOwnerName),
    ("parses real Neverwinter dummy damage line", ParsesRealNeverwinterDummyDamageLine),
    ("parses real Neverwinter companion damage line", ParsesRealNeverwinterCompanionDamageLine)
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
    var parsed = Parse("24:04:25:12:00:02.0::Ar-chew,P[123],Ar-chew,P[123],Target Dummy,C[1],Aimed Shot,Pow[77],Physical,,10,10");

    AssertEqual(EventClassification.Damage, parsed.Classification);
}

static void DoesNotCountPowerResourceRowsAsDamage()
{
    var parsed = Parse("26:04:15:10:00:32.6::Tensielha,P[517525049@33087734 Tensielha@imortal#9562],,*,,*,Lightning Flash,Pn.T6dlqb1,TriggerComplex,ShowPowerDisplayName,2328.68,0");

    AssertEqual(EventClassification.Meta, parsed.Classification);
}

static void RecoversUnquotedCommaInOwnerName()
{
    var parsed = Parse("24:04:25:12:00:03.0::Owner, With Comma,P[1],Owner, With Comma,P[1],Target,C[2],Power,Pow[3],Damage,,10,10");

    AssertEqual("Owner, With Comma", parsed.OwnerName);
}

static void ParsesRealNeverwinterDummyDamageLine()
{
    var parsed = Parse("26:04:15:10:00:32.4::Tensielha,P[517525049@33087734 Tensielha@imortal#9562],,*,Target Dummy,C[289991 Entity_Targetdummy],Ray of Frost,Pn.N8u9bx,Physical,Critical,24481.9,36722.8");

    AssertEqual("Tensielha", parsed.OwnerName);
    AssertEqual("", parsed.SourceName);
    AssertEqual("*", parsed.SourceRef);
    AssertEqual("Target Dummy", parsed.TargetName);
    AssertEqual("Ray of Frost", parsed.PowerName);
    AssertEqual(EventClassification.Damage, parsed.Classification);
    AssertTrue(parsed.IsCritical, "real Neverwinter critical flag should be detected");
}

static void ParsesRealNeverwinterCompanionDamageLine()
{
    var parsed = Parse("26:04:15:10:00:37.5::Tensielha,P[517525049@33087734 Tensielha@imortal#9562],Disapointment,C[289998 Pet_M28_Flapjack],Target Dummy,C[289991 Entity_Targetdummy],Loose the Ballista!,Pn.Wxjue81,Physical,,154234,231351");

    AssertEqual("Tensielha", parsed.OwnerName);
    AssertEqual("Disapointment", parsed.SourceName);
    AssertEqual("C[289998 Pet_M28_Flapjack]", parsed.SourceRef);
    AssertEqual("Loose the Ballista!", parsed.PowerName);
    AssertEqual(154234d, parsed.Magnitude);
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
