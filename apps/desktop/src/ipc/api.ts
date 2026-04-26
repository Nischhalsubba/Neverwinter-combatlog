import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { localEngine } from "./localEngine";

export type SourceStatusDto = {
  state: "missing" | "ready" | "watching" | "warning" | "disconnected";
  path: string | null;
  message: string;
};

export type LiveRankingRowDto = {
  rank: number;
  name: string;
  encDps: number;
  totalDamage: number;
  bossDamage: number;
  critRate: number;
  deaths: number;
};

export type ImportedLogDto = {
  path: string;
  name: string;
  sizeBytes: number;
  lineCount: number;
  parsedCount: number;
  failedCount: number;
  durationSeconds: number;
  encDps: number;
  classificationCounts: Array<{
    classification: string;
    count: number;
  }>;
  partyDamage: PartyDamageDto[];
  companionDamage: PartyDamageDto[];
};

export type WidgetStatusDto = {
  isOpen: boolean;
};

export type LiveSourcePreviewDto = {
  path: string | null;
  lineCount: number;
  parsedCount: number;
  failedCount: number;
  durationSeconds: number;
  encDps: number;
  classificationCounts: Array<{
    classification: string;
    count: number;
  }>;
  partyDamage: PartyDamageDto[];
  companionDamage: PartyDamageDto[];
  history: LiveHistoryRecordDto[];
  recentEvents: Array<{
    timestamp: string | null;
    classification: string;
    summary: string;
  }>;
};

export type LiveHistoryRecordDto = {
  id: string;
  title: string;
  sourcePath: string;
  lineCount: number;
  parsedCount: number;
  failedCount: number;
  durationSeconds: number;
  encDps: number;
  totalDamage: number;
  partyDamage: PartyDamageDto[];
  companionDamage: PartyDamageDto[];
};

export type PartyDamageDto = {
  rank: number;
  name: string;
  totalDamage: number;
  encDps: number;
  durationSeconds: number;
  hitCount: number;
  critCount: number;
  critRate: number;
  topPower: string | null;
  sourceKind: string;
  ownerName: string | null;
  damageTrend: number[];
  powerBreakdown: Array<{
    powerName: string;
    totalDamage: number;
    hitCount: number;
  }>;
};

export function getSourceStatus() {
  const bridge = getNexusBridge();
  if (bridge) {
    return fromBridge<SourceStatusDto>(bridge.GetSourceStatusJson());
  }

  if (!hasTauriRuntime()) {
    return localEngine.getSourceStatus();
  }

  return invoke<SourceStatusDto>("get_source_status");
}

export function chooseLiveLogFolder() {
  return chooseLiveLogFolderWithDialog();
}

export function chooseLiveLogFile() {
  return chooseLiveLogFileWithDialog();
}

export async function chooseLiveLogFolderWithDialog() {
  const bridge = getNexusBridge();
  if (bridge) {
    return fromBridge<SourceStatusDto>(bridge.ChooseLiveLogFolderJson());
  }

  if (!hasTauriRuntime()) {
    return localEngine.chooseLiveLogFolder();
  }

  const selected = await openDialogWithWidgetHidden({
    directory: true,
    multiple: false,
    title: "Choose Neverwinter log folder",
  });

  if (typeof selected !== "string") {
    return getSourceStatus();
  }

  return invoke<SourceStatusDto>("set_live_log_folder", { path: selected });
}

export async function chooseLiveLogFileWithDialog() {
  const bridge = getNexusBridge();
  if (bridge) {
    return fromBridge<SourceStatusDto>(bridge.ChooseLiveLogFileJson());
  }

  if (!hasTauriRuntime()) {
    return localEngine.chooseLiveLogFile();
  }

  const selected = await openDialogWithWidgetHidden({
    directory: false,
    multiple: false,
    title: "Choose Neverwinter combat log",
    filters: [{ name: "Combat logs", extensions: ["log"] }],
  });

  if (typeof selected !== "string") {
    return getSourceStatus();
  }

  return invoke<SourceStatusDto>("set_live_log_file", { path: selected });
}

export function getLiveSourcePreview() {
  const bridge = getNexusBridge();
  if (bridge) {
    return fromBridge<LiveSourcePreviewDto>(bridge.GetLiveSourcePreviewJson());
  }

  if (!hasTauriRuntime()) {
    return localEngine.getLiveSourcePreview();
  }

  return invoke<LiveSourcePreviewDto>("get_live_source_preview");
}

export function resetLiveCounter() {
  const bridge = getNexusBridge();
  if (bridge) {
    return fromBridge<LiveSourcePreviewDto>(bridge.ResetLiveCounterJson());
  }

  if (!hasTauriRuntime()) {
    return localEngine.resetLiveCounter();
  }

  return invoke<LiveSourcePreviewDto>("reset_live_counter");
}

export function getImportedLogs() {
  const bridge = getNexusBridge();
  if (bridge) {
    return fromBridge<ImportedLogDto[]>(bridge.GetImportedLogsJson());
  }

  if (!hasTauriRuntime()) {
    return localEngine.getImportedLogs();
  }

  return invoke<ImportedLogDto[]>("get_imported_logs");
}

export function importLogFiles() {
  return importLogFilesWithDialog();
}

export async function importLogFilesWithDialog() {
  const bridge = getNexusBridge();
  if (bridge) {
    return fromBridge<ImportedLogDto[]>(bridge.ImportLogFilesJson());
  }

  if (!hasTauriRuntime()) {
    return localEngine.importLogFiles();
  }

  const selected = await openDialogWithWidgetHidden({
    directory: false,
    multiple: true,
    title: "Import recorded combat logs",
    filters: [{ name: "Combat logs", extensions: ["log"] }],
  });

  if (!selected) {
    return getImportedLogs();
  }

  const paths = Array.isArray(selected) ? selected : [selected];
  return invoke<ImportedLogDto[]>("import_log_file_paths", { paths });
}

export function getLiveRankings() {
  if (!hasTauriRuntime()) {
    return Promise.resolve([]);
  }

  return invoke<LiveRankingRowDto[]>("get_live_rankings");
}

export function getWidgetStatus() {
  const bridge = getNexusBridge();
  if (bridge) {
    return fromBridge<WidgetStatusDto>(bridge.GetWidgetStatusJson());
  }

  if (!hasTauriRuntime()) {
    return localEngine.getWidgetStatus();
  }

  return invoke<WidgetStatusDto>("get_widget_status");
}

export function openWidgetWindow() {
  const bridge = getNexusBridge();
  if (bridge) {
    return fromBridge<WidgetStatusDto>(bridge.OpenWidgetWindowJson());
  }

  if (!hasTauriRuntime()) {
    return localEngine.openWidgetWindow();
  }

  return invoke<WidgetStatusDto>("open_widget_window");
}

export function closeWidgetWindow() {
  const bridge = getNexusBridge();
  if (bridge) {
    return fromBridge<WidgetStatusDto>(bridge.CloseWidgetWindowJson());
  }

  if (!hasTauriRuntime()) {
    return localEngine.closeWidgetWindow();
  }

  return invoke<WidgetStatusDto>("close_widget_window");
}

export function toggleWidgetWindow() {
  const bridge = getNexusBridge();
  if (bridge) {
    return fromBridge<WidgetStatusDto>(bridge.ToggleWidgetWindowJson());
  }

  if (!hasTauriRuntime()) {
    return localEngine.toggleWidgetWindow();
  }

  return invoke<WidgetStatusDto>("toggle_widget_window");
}

type OpenDialogOptions = Parameters<typeof openDialog>[0];

async function openDialogWithWidgetHidden(options: OpenDialogOptions) {
  const widget = await getWidgetStatus();

  if (widget.isOpen) {
    await closeWidgetWindow();
    await delay(120);
  }

  try {
    return await openDialog(options);
  } finally {
    if (widget.isOpen) {
      await openWidgetWindow();
    }
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

type NexusBridge = {
  GetSourceStatusJson: () => string;
  ChooseLiveLogFolderJson: () => string;
  ChooseLiveLogFileJson: () => string;
  GetLiveSourcePreviewJson: () => string;
  ResetLiveCounterJson: () => string;
  GetImportedLogsJson: () => string;
  ImportLogFilesJson: () => string;
  GetWidgetStatusJson: () => string;
  OpenWidgetWindowJson: () => string;
  CloseWidgetWindowJson: () => string;
  ToggleWidgetWindowJson: () => string;
};

function getNexusBridge(): NexusBridge | null {
  return (
    (window as unknown as { chrome?: { webview?: { hostObjects?: { sync?: { nexus?: NexusBridge } } } } })
      .chrome?.webview?.hostObjects?.sync?.nexus ?? null
  );
}

function hasTauriRuntime() {
  return Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

function fromBridge<T>(json: string): Promise<T> {
  return Promise.resolve(JSON.parse(json) as T);
}
