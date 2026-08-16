import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseText } from '../src/engine/fast-parser-core.js';
import {
  NW_HUB_CAPTURED_PROFILE,
  buildNwHubCompatibility,
  formatNwHubDuration,
  formatNwHubNumber
} from '../src/engine/nwhub-compatibility.js';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/nwhub-compatibility.mjs <combat.log>');
  process.exit(2);
}

const text = await readFile(resolve(input), 'utf8');
const parsed = parseText(text);
const compatibility = buildNwHubCompatibility(parsed.rows, parsed.summary.players || []);

const snapshot = {
  schemaVersion: 1,
  sourceProfile: NW_HUB_CAPTURED_PROFILE,
  input: {
    file: input.split(/[\\/]/).pop(),
    lines: parsed.summary.totalLines,
    parsed: parsed.summary.parsedLines,
    rejected: parsed.summary.rejectedLines
  },
  encounterClock: {
    count: compatibility.encounterCount,
    seconds: compatibility.encounterTime,
    windows: compatibility.encounters.map((window, index) => ({
      id: index + 1,
      start: window.start,
      end: window.end,
      duration: window.duration
    }))
  },
  players: compatibility.players
    .slice()
    .sort((a, b) => b.damage - a.damage || a.name.localeCompare(b.name))
    .map(player => ({
      ref: player.ref,
      name: player.name,
      damage: player.damage,
      damageDisplay: formatNwHubNumber(player.damage),
      hits: player.hits,
      duration: player.duration,
      durationDisplay: formatNwHubDuration(player.duration),
      dps: player.dps,
      dpsDisplay: formatNwHubNumber(player.dps),
      combatTime: player.combatTime,
      combatDps: player.combatDps,
      combatDpsDisplay: formatNwHubNumber(player.combatDps),
      participatedEncounters: player.participatedEncounters
    }))
};

process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
