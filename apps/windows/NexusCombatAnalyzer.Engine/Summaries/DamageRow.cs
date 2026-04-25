namespace NexusCombatAnalyzer.Engine.Summaries;

public sealed record DamageRow(
    string Name,
    string Ref,
    string? OwnerName,
    double Damage,
    int Hits,
    int CriticalHits,
    string TopPower)
{
    public double CriticalRate => Hits == 0 ? 0 : CriticalHits / (double)Hits;
}
