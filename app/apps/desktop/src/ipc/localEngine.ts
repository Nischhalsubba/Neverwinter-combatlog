import type { ImportedLogDto, LiveSourcePreviewDto, PartyDamageDto, SourceStatusDto, WidgetStatusDto } from "./api";

type ParsedEvent = {
  timestampMs: number | null;
  ownerName: string;
  ownerRef: string;
  sourceName: string;
  sourceRef: string;
  powerName: string;
  eventType: string;
  flags: string[];
  magnitude: number;
  classification: string;
};

type MutableDamageRow = {
  name: string;
  ownerName: string | null;
  sourceKind: string;
  totalDamage: number;
  durationSeconds: number;
  hitCount: number;
  critCount: number;
  powers: Map<string, { totalDamage: number; hitCount: number }>;
  trend: number[];
};

let sourceStatus: SourceStatusDto = {
  state: "missing",
  path: null,
  message: "Browser-safe mode is running. Choose a log file or folder to load combat data.",
};

let livePreview: LiveSourcePreviewDto = emptyPreview(null, []);
let importedLogs: ImportedLogDto[] = [];
let widgetStatus: WidgetStatusDto = { isOpen: false };

export const localEngine = {
  getSourceStatus: async () => sourceStatus,
  getLiveSourcePreview: async () => livePreview,
  getImportedLogs: async () => importedLogs,
  getWidgetStatus: async () => widgetStatus,
  openWidgetWindow: async () => {
    widgetStatus = { isOpen: true };
    return widgetStatus;
  },
  closeWidgetWindow: async () => {
    widgetStatus = { isOpen: false };
    return widgetStatus;
  },
  toggleWidgetWindow: async () => {
    widgetStatus = { isOpen: !widgetStatus.isOpen };
    return widgetStatus;
  },
  chooseLiveLogFile: async () => {
    const files = await pickFiles({ multiple: false, webkitDirectory: false });
    const file = files[0];
    if (!file) {
      return sourceStatus;
    }

    const summary = await summarizeFile(file);
    livePreview = toLivePreview(summary);
    sourceStatus = {
      state: "watching",
      path: summary.path,
      message: `Loaded ${summary.name}. Browser mode reads the selected file snapshot.`,
    };
    return sourceStatus;
  },
  chooseLiveLogFolder: async () => {
    const files = await pickFiles({ multiple: true, webkitDirectory: true });
    const latestCombatLog = files
      .filter((file) => /combat.*\.log$/i.test(file.name))
      .sort((left, right) => right.lastModified - left.lastModified)[0];

    if (!latestCombatLog) {
      sourceStatus = {
        state: "warning",
        path: null,
        message: "No Combat*.log file was found in the selected folder.",
      };
      return sourceStatus;
    }

    const summary = await summarizeFile(latestCombatLog);
    livePreview = toLivePreview(summary);
    sourceStatus = {
      state: "watching",
      path: summary.path,
      message: `Loaded latest folder combat log: ${summary.name}.`,
    };
    return sourceStatus;
  },
  resetLiveCounter: async () => {
    if (livePreview.lineCount > 0) {
      livePreview = {
        ...emptyPreview(livePreview.path, livePreview.history),
        history: [
          {
            id: `${Date.now()}`,
            title: `Fight ${livePreview.history.length + 1}`,
            sourcePath: livePreview.path ?? "Browser file",
            lineCount: livePreview.lineCount,
            parsedCount: livePreview.parsedCount,
            failedCount: livePreview.failedCount,
            durationSeconds: livePreview.durationSeconds,
            encDps: livePreview.encDps,
            totalDamage: sumDamage(livePreview.partyDamage) + sumDamage(livePreview.companionDamage),
            partyDamage: livePreview.partyDamage,
            companionDamage: livePreview.companionDamage,
          },
          ...livePreview.history,
        ],
      };
    }

    return livePreview;
  },
  importLogFiles: async () => {
    const files = await pickFiles({ multiple: true, webkitDirectory: false });
    if (!files.length) {
      return importedLogs;
    }

    const summaries = await Promise.all(files.map(summarizeFile));
    importedLogs = [...summaries.map(toImportedLog), ...importedLogs];
    return importedLogs;
  },
};

function emptyPreview(path: string | null, history: LiveSourcePreviewDto["history"] = livePreview.history): LiveSourcePreviewDto {
  return {
    path,
    lineCount: 0,
    parsedCount: 0,
    failedCount: 0,
    durationSeconds: 0,
    encDps: 0,
    classificationCounts: [],
    partyDamage: [],
    companionDamage: [],
    history,
    recentEvents: [],
  };
}

async function summarizeFile(file: File) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  const players = new Map<string, MutableDamageRow>();
  const companions = new Map<string, MutableDamageRow>();
  const classificationCounts = new Map<string, number>();
  const recentEvents: LiveSourcePreviewDto["recentEvents"] = [];
  let parsedCount = 0;
  let failedCount = 0;
  let firstDamageAt: number | null = null;
  let lastDamageAt: number | null = null;

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) {
      failedCount++;
      continue;
    }

    parsedCount++;
    classificationCounts.set(parsed.classification, (classificationCounts.get(parsed.classification) ?? 0) + 1);
    if (recentEvents.length < 8) {
      recentEvents.unshift({
        timestamp: null,
        classification: parsed.classification,
        summary: `${parsed.ownerName || parsed.sourceName} used ${parsed.powerName || "Unknown"} for ${Math.round(parsed.magnitude).toLocaleString()}`,
      });
    }

    if (!isCanonicalPublishedDamage(parsed)) {
      continue;
    }

    if (parsed.timestampMs !== null) {
      firstDamageAt ??= parsed.timestampMs;
      lastDamageAt = parsed.timestampMs;
    }

    const companion = isCompanion(parsed);
    const key = companion ? stableKey(parsed.sourceName, parsed.sourceRef) : stableKey(parsed.ownerName, parsed.ownerRef);
    const bucket = companion ? companions : players;
    const existing = bucket.get(key) ?? createDamageRow(companion ? parsed.sourceName : parsed.ownerName, companion ? parsed.ownerName : null, companion ? "companion" : "player");
    addDamage(existing, parsed);
    bucket.set(key, existing);
  }

  const durationSeconds = calculateDurationSeconds(firstDamageAt, lastDamageAt);
  const partyDamage = finalizeRows(players, durationSeconds);
  const companionDamage = finalizeRows(companions, durationSeconds);

  return {
    path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    name: file.name,
    sizeBytes: file.size,
    lineCount: lines.length,
    parsedCount,
    failedCount,
    durationSeconds,
    encDps: durationSeconds > 0 ? (sumDamage(partyDamage) + sumDamage(companionDamage)) / durationSeconds : sumDamage(partyDamage) + sumDamage(companionDamage),
    classificationCounts: [...classificationCounts.entries()].map(([classification, count]) => ({ classification, count })),
    partyDamage,
    companionDamage,
    recentEvents,
  };
}

function parseLine(line: string): ParsedEvent | null {
  const separatorIndex = line.indexOf("::");
  if (separatorIndex < 0) {
    return null;
  }

  const tokens = recoverLegacyUnquotedCommas(tokenize(line.slice(separatorIndex + 2).trim()));
  if (tokens.length !== 12) {
    return null;
  }

  const magnitude = Number.parseFloat(tokens[10]);
  if (!Number.isFinite(magnitude)) {
    return null;
  }

  const eventType = tokens[8] ?? "";
  const flags = (tokens[9] ?? "").split("|").map((flag) => flag.trim()).filter(Boolean);
  return {
    timestampMs: parseNeverwinterTimestamp(line.slice(0, separatorIndex).trim()),
    ownerName: tokens[0] || tokens[2] || "Unknown",
    ownerRef: tokens[1] || tokens[3] || "",
    sourceName: tokens[2] || tokens[0] || "Unknown",
    sourceRef: tokens[3] || tokens[1] || "",
    powerName: tokens[6] || "Unknown",
    eventType,
    flags,
    magnitude,
    classification: classify(eventType, tokens[9] ?? "", magnitude),
  };
}

function tokenize(payload: string) {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < payload.length; index++) {
    const character = payload[index];
    if (character === "\"") {
      if (inQuotes && payload[index + 1] === "\"") {
        current += "\"";
        index++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      tokens.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  tokens.push(current.trim());
  return tokens;
}

function recoverLegacyUnquotedCommas(tokens: string[]) {
  const recovered = [...tokens];
  let overflow = recovered.length - 12;
  for (let index = 0; index <= 4 && overflow > 0 && index + 1 < recovered.length; index += 2) {
    recovered[index] = `${recovered[index]}, ${recovered[index + 1]}`;
    recovered.splice(index + 1, 1);
    overflow--;
  }
  return recovered;
}

function classify(eventType: string, flags: string, magnitude: number) {
  const normalizedType = eventType.trim().toLowerCase();
  const normalizedFlags = flags.trim().toLowerCase();
  if (normalizedType.includes("heal") || normalizedFlags.includes("heal") || (normalizedType === "hitpoints" && magnitude < 0)) {
    return "Healing";
  }
  if (normalizedType === "shield" || normalizedFlags.includes("shield")) {
    return normalizedFlags.includes("break") ? "ShieldBreak" : "ShieldDamage";
  }
  if (normalizedFlags.includes("immune")) {
    return "Immune";
  }
  if (normalizedType === "power" || normalizedType.includes("resource") || normalizedFlags.includes("resource")) {
    return "Resource";
  }
  if (normalizedType === "triggercomplex") {
    return "Meta";
  }
  if (normalizedType.includes("summon") || normalizedFlags.includes("summon")) {
    return "Summon";
  }
  if (normalizedType.includes("control") || normalizedFlags.includes("control")) {
    return "Control";
  }
  if (magnitude > 0 && ["physical", "arcane", "cold", "fire", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder", "force", "untyped"].includes(normalizedType)) {
    return "Damage";
  }
  return "Unknown";
}

function isPlayerRef(reference: string) {
  return reference.trimStart().startsWith("P[");
}

function isCanonicalPublishedDamage(parsed: ParsedEvent) {
  if (parsed.classification !== "Damage" || parsed.magnitude <= 0) return false;
  if (parsed.eventType.trim().toLowerCase() !== "physical") return false;
  if (!isPlayerRef(parsed.ownerRef)) return false;
  return !parsed.flags.some((flag) => {
    const normalized = flag.toLowerCase();
    return normalized === "immune" || normalized === "showpowerdisplayname";
  });
}

function isCompanionRef(reference: string) {
  const normalized = reference.toLowerCase();
  return normalized.includes("pet_")
    || normalized.includes("companion")
    || normalized.includes("appointment")
    || normalized.includes("summon");
}

function isCompanion(parsed: ParsedEvent) {
  if (!isPlayerRef(parsed.ownerRef) || !parsed.ownerRef || parsed.ownerRef.toLowerCase() === parsed.sourceRef.toLowerCase()) {
    return false;
  }
  const text = `${parsed.sourceName} ${parsed.powerName}`.toLowerCase();
  return isCompanionRef(parsed.sourceRef)
    || text.includes("companion")
    || text.includes("pet")
    || text.includes("appointment")
    || text.includes("summon");
}

function createDamageRow(name: string, ownerName: string | null, sourceKind: string): MutableDamageRow {
  return {
    name: name || "Unknown",
    ownerName,
    sourceKind,
    totalDamage: 0,
    durationSeconds: 0,
    hitCount: 0,
    critCount: 0,
    powers: new Map(),
    trend: [],
  };
}

function addDamage(row: MutableDamageRow, parsed: ParsedEvent) {
  row.totalDamage += parsed.magnitude;
  row.hitCount++;
  if (parsed.flags.some((flag) => flag.toLowerCase().includes("critical"))) {
    row.critCount++;
  }
  const current = row.powers.get(parsed.powerName) ?? { totalDamage: 0, hitCount: 0 };
  current.totalDamage += parsed.magnitude;
  current.hitCount++;
  row.powers.set(parsed.powerName, current);
  row.trend.push(parsed.magnitude);
}

function finalizeRows(rows: Map<string, MutableDamageRow>, durationSeconds: number): PartyDamageDto[] {
  return [...rows.values()]
    .sort((left, right) => right.totalDamage - left.totalDamage)
    .map((row, index) => {
      const powerBreakdown = [...row.powers.entries()]
        .map(([powerName, power]) => ({ powerName, totalDamage: power.totalDamage, hitCount: power.hitCount }))
        .sort((left, right) => right.totalDamage - left.totalDamage);
      return {
        rank: index + 1,
        name: row.name,
        totalDamage: row.totalDamage,
        encDps: durationSeconds > 0 ? row.totalDamage / durationSeconds : row.totalDamage,
        durationSeconds,
        hitCount: row.hitCount,
        critCount: row.critCount,
        critRate: row.hitCount > 0 ? row.critCount / row.hitCount : 0,
        topPower: powerBreakdown[0]?.powerName ?? null,
        sourceKind: row.sourceKind,
        ownerName: row.ownerName,
        damageTrend: compressTrend(row.trend),
        powerBreakdown,
      };
    });
}

function compressTrend(values: number[]) {
  if (values.length <= 24) {
    return values;
  }
  const bucketSize = Math.ceil(values.length / 24);
  const buckets: number[] = [];
  values.forEach((value, index) => {
    const bucket = Math.floor(index / bucketSize);
    buckets[bucket] = (buckets[bucket] ?? 0) + value;
  });
  return buckets;
}

function toLivePreview(summary: Awaited<ReturnType<typeof summarizeFile>>): LiveSourcePreviewDto {
  return {
    path: summary.path,
    lineCount: summary.lineCount,
    parsedCount: summary.parsedCount,
    failedCount: summary.failedCount,
    durationSeconds: summary.durationSeconds,
    encDps: summary.encDps,
    classificationCounts: summary.classificationCounts,
    partyDamage: summary.partyDamage,
    companionDamage: summary.companionDamage,
    history: livePreview.history,
    recentEvents: summary.recentEvents,
  };
}

function toImportedLog(summary: Awaited<ReturnType<typeof summarizeFile>>): ImportedLogDto {
  return {
    path: summary.path,
    name: summary.name,
    sizeBytes: summary.sizeBytes,
    lineCount: summary.lineCount,
    parsedCount: summary.parsedCount,
    failedCount: summary.failedCount,
    durationSeconds: summary.durationSeconds,
    encDps: summary.encDps,
    classificationCounts: summary.classificationCounts,
    partyDamage: summary.partyDamage,
    companionDamage: summary.companionDamage,
  };
}

function stableKey(name: string, reference: string) {
  return reference.trim() || name.trim() || "Unknown";
}

function sumDamage(rows: PartyDamageDto[]) {
  return rows.reduce((sum, row) => sum + row.totalDamage, 0);
}

function calculateDurationSeconds(firstDamageAt: number | null, lastDamageAt: number | null) {
  if (firstDamageAt === null || lastDamageAt === null) {
    return 0;
  }
  const seconds = (lastDamageAt - firstDamageAt) / 1000;
  return seconds <= 0 ? 1 : seconds;
}

function parseNeverwinterTimestamp(rawTimestamp: string) {
  const match = rawTimestamp.match(/^(\d{2}):(\d{2}):(\d{2}):(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second, fraction = "0"] = match;
  const milliseconds = Number(`0.${fraction}`) * 1000;
  return new Date(
    2000 + Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Math.floor(milliseconds),
  ).getTime();
}

function pickFiles({ multiple, webkitDirectory }: { multiple: boolean; webkitDirectory: boolean }) {
  return new Promise<File[]>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".log,text/plain";
    input.multiple = multiple;
    if (webkitDirectory) {
      input.setAttribute("webkitdirectory", "");
      input.setAttribute("directory", "");
    }
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", () => {
      const files = Array.from(input.files ?? []);
      input.remove();
      resolve(files);
    }, { once: true });
    input.click();
  });
}