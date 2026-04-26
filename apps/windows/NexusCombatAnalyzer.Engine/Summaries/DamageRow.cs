namespace NexusCombatAnalyzer.Engine.Summaries;

public sealed record DamageRow(
    string Name,
    string Ref,
    string? OwnerName,
    double Damage,
    int Hits,
    int CriticalHits,
    string TopPower,
    IReadOnlyList<PowerDamageRow> PowerBreakdown,
    IReadOnlyList<double> DamageTrend)
{
    public double CriticalRate => Hits == 0 ? 0 : CriticalHits / (double)Hits;
}

public sealed record PowerDamageRow(string PowerName, double TotalDamage, int HitCount);
