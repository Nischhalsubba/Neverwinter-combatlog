import { useState } from "react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { getCombatAiSettings, saveCombatAiSettings } from "../../ai/combatInsights";

const sections = [
  {
    title: "Sources",
    body: "Remember live folders, selected files, latest Combat*.log detection, rotation recovery, and import defaults.",
  },
  {
    title: "Parsing",
    body: "Control verbose parser logging, raw support rows, unknown rows, malformed-line handling, and parser confidence display.",
  },
  {
    title: "Attribution",
    body: "Merge pets into owners, show pets separately, clean NPC identities, and preserve uncertain owner links.",
  },
  {
    title: "Encounter Rules",
    body: "Tune inactivity timeout, noise starters, boss naming heuristics, manual split/merge behavior, and combat start rules.",
  },
  {
    title: "Display",
    body: "Choose density, theme, accent color, table columns, number formatting, and beginner/advanced visibility.",
  },
  {
    title: "Widget",
    body: "Persist widget content, size, opacity, position, always-on-top, click-through, hotkey, and presets.",
  },
  {
    title: "Export",
    body: "Configure CSV, JSON, clipboard summaries, screenshot-friendly panels, and encounter summary output.",
  },
  {
    title: "Debug",
    body: "Inspect raw lines, parsed objects, classifications, ownership decisions, encounter assignment, and parse failures.",
  },
];

export function SettingsScreen() {
  const [aiSettings, setAiSettings] = useState(getCombatAiSettings);
  const [saved, setSaved] = useState(false);

  function saveAi() {
    saveCombatAiSettings(aiSettings);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <section className="screen-grid">
      <div className="screen-heading">
        <div>
          <p className="eyebrow">Power User Mode</p>
          <h1>Settings</h1>
          <p>Configure parser behavior, attribution, encounter rules, display density, widget presets, exports, and debug logging.</p>
        </div>
      </div>
      <Card className="panel settings-ai-panel" component="article">
        <div>
          <p className="eyebrow">Optional AI</p>
          <h2>OpenRouter free-model insights</h2>
          <p>
            Add your own OpenRouter API key to generate short combat reviews from parsed metrics. The app stores the key only in this browser profile.
          </p>
        </div>
        <div className="settings-ai-form">
          <TextField
            label="OpenRouter API key"
            onChange={(event) => setAiSettings((current) => ({ ...current, apiKey: event.target.value }))}
            placeholder="sk-or-..."
            type="password"
            value={aiSettings.apiKey}
          />
          <TextField
            label="Model"
            onChange={(event) => setAiSettings((current) => ({ ...current, model: event.target.value }))}
            value={aiSettings.model}
          />
          <Button onClick={saveAi} variant="contained">
            {saved ? "Saved" : "Save AI Settings"}
          </Button>
        </div>
      </Card>
      <div className="settings-grid">
        {sections.map((section) => (
          <Card key={section.title} className="panel" component="article">
            <h2>{section.title}</h2>
            <p>{section.body}</p>
            <Divider />
            <div className="setting-row">
              <span>Ready for persistent controls</span>
              <Switch />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
