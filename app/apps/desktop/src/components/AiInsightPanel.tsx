import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import type { LiveSourcePreviewDto, PartyDamageDto } from "../ipc/api";
import { generateCombatInsight, hasCombatAiKey } from "../ai/combatInsights";

type AiInsightPanelProps = {
  preview: LiveSourcePreviewDto | undefined;
  selected?: PartyDamageDto | null;
};

export function AiInsightPanel({ preview, selected }: AiInsightPanelProps) {
  const [insight, setInsight] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const aiReady = hasCombatAiKey();

  async function runAnalysis() {
    setLoading(true);
    setError("");
    try {
      setInsight(await generateCombatInsight({ preview, selected }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="panel ai-insight-panel" component="article">
      <div className="panel-header">
        <div>
          <p className="eyebrow">AI Analyst</p>
          <h2>{selected ? "Combatant review" : "Encounter review"}</h2>
          <p>Optional OpenRouter free-model analysis using only parsed combat metrics.</p>
        </div>
        <Button
          aria-label={loading ? "Generating AI combat insight" : "Generate AI combat insight"}
          disabled={loading || !aiReady || !preview?.parsedCount}
          onClick={runAnalysis}
          variant="contained"
        >
          {loading ? <CircularProgress color="inherit" size={18} /> : "Generate"}
        </Button>
      </div>
      {!aiReady ? (
        <Alert severity="info">Add an OpenRouter API key in Settings to enable free-model AI insights.</Alert>
      ) : null}
      {error ? <Alert severity="warning">{error}</Alert> : null}
      {insight ? (
        <Typography className="ai-insight-copy" component="pre">
          {insight}
        </Typography>
      ) : (
        <p className="detail-note">The app sends summary metrics only, not the full raw combat log.</p>
      )}
    </Card>
  );
}
