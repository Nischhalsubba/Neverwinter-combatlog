import type { LiveSourcePreviewDto, PartyDamageDto } from "../ipc/api";
import { buildDamageRows } from "../lib/damageRows";

const API_KEY_STORAGE_KEY = "astral.openrouter.apiKey";
const MODEL_STORAGE_KEY = "astral.openrouter.model";
const DEFAULT_MODEL = "openrouter/free";

export type CombatAiSettings = {
  apiKey: string;
  model: string;
};

export type CombatInsightInput = {
  preview: LiveSourcePreviewDto | undefined;
  selected?: PartyDamageDto | null;
};

export function getCombatAiSettings(): CombatAiSettings {
  return {
    apiKey: localStorage.getItem(API_KEY_STORAGE_KEY) ?? "",
    model: localStorage.getItem(MODEL_STORAGE_KEY) ?? DEFAULT_MODEL,
  };
}

export function saveCombatAiSettings(settings: CombatAiSettings) {
  localStorage.setItem(API_KEY_STORAGE_KEY, settings.apiKey.trim());
  localStorage.setItem(MODEL_STORAGE_KEY, settings.model.trim() || DEFAULT_MODEL);
}

export function hasCombatAiKey() {
  return Boolean(getCombatAiSettings().apiKey);
}

export async function generateCombatInsight({ preview, selected }: CombatInsightInput) {
  const settings = getCombatAiSettings();
  if (!settings.apiKey) {
    throw new Error("Add an OpenRouter API key in Settings before generating AI insights.");
  }

  const payload = buildInsightPayload(preview, selected);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "Astral Combat",
    },
    body: JSON.stringify({
      model: settings.model || DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an expert Neverwinter combat log analyst. Give concise, practical, non-toxic performance review. Use only the metrics provided. Do not invent missing abilities, classes, or mechanics.",
        },
        {
          role: "user",
          content: `Analyze this combat log summary and return:
1. Three key observations
2. Two likely improvement targets
3. One parser/data-quality warning if needed

Metrics:
${JSON.stringify(payload, null, 2)}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 420,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI request failed (${response.status}): ${errorText.slice(0, 240)}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || "No AI insight was returned.";
}

function buildInsightPayload(preview: LiveSourcePreviewDto | undefined, selected?: PartyDamageDto | null) {
  const rows = buildDamageRows(preview?.partyDamage ?? [], preview?.companionDamage ?? [], true);
  const totalDamage = rows.reduce((sum, row) => sum + row.totalDamage, 0);
  const totalHits = rows.reduce((sum, row) => sum + row.hitCount, 0);
  const totalCrits = rows.reduce((sum, row) => sum + row.critCount, 0);
  const durationSeconds = preview?.durationSeconds ?? 0;

  return {
    scope: selected ? "selected combatant" : "encounter",
    source: preview?.path ?? "no source",
    durationSeconds,
    totalDamage: Math.round(totalDamage),
    encDps: Math.round(durationSeconds > 0 ? totalDamage / durationSeconds : totalDamage),
    parsedEvents: preview?.parsedCount ?? 0,
    failedEvents: preview?.failedCount ?? 0,
    critRate: totalHits > 0 ? totalCrits / totalHits : 0,
    topCombatants: rows.slice(0, 6).map((row) => ({
      name: row.name,
      damage: Math.round(row.totalDamage),
      encDps: Math.round(row.encDps),
      share: totalDamage > 0 ? row.totalDamage / totalDamage : 0,
      critRate: row.critRate,
      topPower: row.topPower,
    })),
    selected: selected
      ? {
          name: selected.name,
          damage: Math.round(selected.totalDamage),
          encDps: Math.round(selected.encDps),
          critRate: selected.critRate,
          hitCount: selected.hitCount,
          topPowers: selected.powerBreakdown.slice(0, 8).map((power) => ({
            power: power.powerName,
            damage: Math.round(power.totalDamage),
            hits: power.hitCount,
          })),
        }
      : null,
  };
}
