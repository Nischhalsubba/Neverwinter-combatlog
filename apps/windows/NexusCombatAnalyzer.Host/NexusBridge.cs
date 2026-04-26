using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Windows.Forms;
using NexusCombatAnalyzer.Engine.Summaries;

namespace NexusCombatAnalyzer.Host;

[ComVisible(true)]
[ClassInterface(ClassInterfaceType.AutoDual)]
public sealed class NexusBridge
{
    private readonly CombatLogSummarizer _summarizer = new();
    private readonly List<ImportedLogDto> _importedLogs = [];
    private readonly List<LiveHistoryRecordDto> _history = [];
    private string? _livePath;
    private long _liveBaselineBytes;
    private bool _widgetOpen;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public string GetSourceStatusJson() => Json(new SourceStatusDto(
        string.IsNullOrWhiteSpace(_livePath) ? "missing" : "watching",
        _livePath,
        string.IsNullOrWhiteSpace(_livePath) ? "No source selected" : $"Watching {Path.GetFileName(_livePath)}"));

    public string ChooseLiveLogFolderJson()
    {
        using var dialog = new FolderBrowserDialog
        {
            Description = "Choose the Neverwinter folder that contains Combat*.log files",
            UseDescriptionForTitle = true
        };

        if (dialog.ShowDialog() != DialogResult.OK)
        {
            return GetSourceStatusJson();
        }

        var latest = Directory
            .EnumerateFiles(dialog.SelectedPath, "combat*.log", SearchOption.TopDirectoryOnly)
            .Concat(Directory.EnumerateFiles(dialog.SelectedPath, "Combat*.log", SearchOption.TopDirectoryOnly))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(path => new FileInfo(path))
            .OrderByDescending(file => file.LastWriteTimeUtc)
            .FirstOrDefault();

        _livePath = latest?.FullName;
        _liveBaselineBytes = 0;
        return GetSourceStatusJson();
    }

    public string ChooseLiveLogFileJson()
    {
        using var dialog = new OpenFileDialog
        {
            Title = "Choose Neverwinter combat log",
            Filter = "Combat logs (*.log)|*.log|All files (*.*)|*.*",
            Multiselect = false
        };

        if (dialog.ShowDialog() != DialogResult.OK)
        {
            return GetSourceStatusJson();
        }

        _livePath = dialog.FileName;
        _liveBaselineBytes = 0;
        return GetSourceStatusJson();
    }

    public string GetLiveSourcePreviewJson() => Json(BuildLivePreview());

    public string ResetLiveCounterJson()
    {
        var current = BuildLivePreview();
        if (!string.IsNullOrWhiteSpace(current.Path) && current.LineCount > 0)
        {
            _history.Insert(0, new LiveHistoryRecordDto(
                Guid.NewGuid().ToString("N"),
                $"Counter {_history.Count + 1}",
                current.Path,
                current.LineCount,
                current.ParsedCount,
                current.FailedCount,
                current.PartyDamage.Sum(row => row.TotalDamage) + current.CompanionDamage.Sum(row => row.TotalDamage),
                current.PartyDamage,
                current.CompanionDamage));
        }

        if (!string.IsNullOrWhiteSpace(_livePath) && File.Exists(_livePath))
        {
            _liveBaselineBytes = new FileInfo(_livePath).Length;
        }

        return Json(BuildLivePreview());
    }

    public string GetImportedLogsJson() => Json(_importedLogs);

    public string ImportLogFilesJson()
    {
        using var dialog = new OpenFileDialog
        {
            Title = "Import recorded combat logs",
            Filter = "Combat logs (*.log)|*.log|All files (*.*)|*.*",
            Multiselect = true
        };

        if (dialog.ShowDialog() == DialogResult.OK)
        {
            foreach (var path in dialog.FileNames)
            {
                var imported = SummarizeImported(path);
                _importedLogs.RemoveAll(log => string.Equals(log.Path, path, StringComparison.OrdinalIgnoreCase));
                _importedLogs.Insert(0, imported);
            }
        }

        return GetImportedLogsJson();
    }

    public string GetWidgetStatusJson() => Json(new WidgetStatusDto(_widgetOpen));

    public string OpenWidgetWindowJson()
    {
        _widgetOpen = true;
        return GetWidgetStatusJson();
    }

    public string CloseWidgetWindowJson()
    {
        _widgetOpen = false;
        return GetWidgetStatusJson();
    }

    public string ToggleWidgetWindowJson()
    {
        _widgetOpen = !_widgetOpen;
        return GetWidgetStatusJson();
    }

    private LiveSourcePreviewDto BuildLivePreview()
    {
        if (string.IsNullOrWhiteSpace(_livePath) || !File.Exists(_livePath))
        {
            return new LiveSourcePreviewDto(null, 0, 0, 0, [], [], [], _history, []);
        }

        var summary = _summarizer.SummarizeFile(_livePath, _liveBaselineBytes);
        return new LiveSourcePreviewDto(
            _livePath,
            summary.LinesRead,
            summary.ParsedLines,
            summary.FailedLines,
            [new ClassificationCountDto("Damage", summary.Players.Sum(row => row.Hits) + summary.Companions.Sum(row => row.Hits))],
            ToPartyRows(summary.Players, "player"),
            ToPartyRows(summary.Companions, "companion"),
            _history,
            BuildRecentEvents(summary));
    }

    private ImportedLogDto SummarizeImported(string path)
    {
        var summary = _summarizer.SummarizeFile(path);
        var info = new FileInfo(path);
        return new ImportedLogDto(
            path,
            info.Name,
            info.Length,
            summary.LinesRead,
            summary.ParsedLines,
            summary.FailedLines,
            [new ClassificationCountDto("Damage", summary.Players.Sum(row => row.Hits) + summary.Companions.Sum(row => row.Hits))],
            ToPartyRows(summary.Players, "player"),
            ToPartyRows(summary.Companions, "companion"));
    }

    private static PartyDamageDto[] ToPartyRows(IReadOnlyList<DamageRow> rows, string sourceKind) =>
        rows
            .OrderByDescending(row => row.Damage)
            .Select((row, index) => new PartyDamageDto(
                index + 1,
                string.IsNullOrWhiteSpace(row.Name) ? "Unknown" : row.Name,
                row.Damage,
                row.Hits,
                row.CriticalHits,
                row.CriticalRate,
                row.TopPower == "Unknown" ? null : row.TopPower,
                sourceKind,
                row.OwnerName,
                row.DamageTrend,
                row.PowerBreakdown.Select(power => new PowerBreakdownDto(power.PowerName, power.TotalDamage, power.HitCount)).ToArray()))
            .ToArray();

    private static RecentEventDto[] BuildRecentEvents(CombatLogSummary summary)
    {
        var rows = summary.Players.Concat(summary.Companions)
            .OrderByDescending(row => row.Damage)
            .Take(6)
            .Select(row => new RecentEventDto(null, "Damage", $"{row.Name} dealt {Math.Round(row.Damage):N0} damage"))
            .ToArray();
        return rows;
    }

    private static string Json<T>(T value) => JsonSerializer.Serialize(value, JsonOptions);

    public sealed record SourceStatusDto(string State, string? Path, string Message);
    public sealed record WidgetStatusDto(bool IsOpen);
    public sealed record ClassificationCountDto(string Classification, long Count);
    public sealed record PowerBreakdownDto(string PowerName, double TotalDamage, int HitCount);
    public sealed record RecentEventDto(string? Timestamp, string Classification, string Summary);
    public sealed record PartyDamageDto(
        int Rank,
        string Name,
        double TotalDamage,
        int HitCount,
        int CritCount,
        double CritRate,
        string? TopPower,
        string SourceKind,
        string? OwnerName,
        IReadOnlyList<double> DamageTrend,
        IReadOnlyList<PowerBreakdownDto> PowerBreakdown);

    public sealed record LiveHistoryRecordDto(
        string Id,
        string Title,
        string SourcePath,
        long LineCount,
        long ParsedCount,
        long FailedCount,
        double TotalDamage,
        IReadOnlyList<PartyDamageDto> PartyDamage,
        IReadOnlyList<PartyDamageDto> CompanionDamage);

    public sealed record LiveSourcePreviewDto(
        string? Path,
        long LineCount,
        long ParsedCount,
        long FailedCount,
        IReadOnlyList<ClassificationCountDto> ClassificationCounts,
        IReadOnlyList<PartyDamageDto> PartyDamage,
        IReadOnlyList<PartyDamageDto> CompanionDamage,
        IReadOnlyList<LiveHistoryRecordDto> History,
        IReadOnlyList<RecentEventDto> RecentEvents);

    public sealed record ImportedLogDto(
        string Path,
        string Name,
        long SizeBytes,
        long LineCount,
        long ParsedCount,
        long FailedCount,
        IReadOnlyList<ClassificationCountDto> ClassificationCounts,
        IReadOnlyList<PartyDamageDto> PartyDamage,
        IReadOnlyList<PartyDamageDto> CompanionDamage);
}
