import { useEffect } from "react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import logoUrl from "../../assets/nexus-logo.png";
import { closeWidgetWindow, getLiveSourcePreview } from "../../ipc/api";

export function WidgetRuntimeScreen() {
  const queryClient = useQueryClient();
  const preview = useQuery({
    queryKey: ["live-source-preview"],
    queryFn: getLiveSourcePreview,
    refetchInterval: 1500,
  });
  const closeWidget = useMutation({
    mutationFn: closeWidgetWindow,
    onSuccess: (data) => queryClient.setQueryData(["widget-status"], data),
  });
  const totalDamage = (preview.data?.partyDamage ?? []).reduce((sum, row) => sum + row.totalDamage, 0);
  const leader = preview.data?.partyDamage[0];
  const maxDamage = Math.max(leader?.totalDamage ?? 0, 1);

  useEffect(() => {
    document.body.classList.add("widget-window-body");

    return () => {
      document.body.classList.remove("widget-window-body");
    };
  }, []);

  return (
    <main className="widget-runtime">
      <header className="widget-runtime-header" data-tauri-drag-region>
        <img alt="Nexus Combat Analyzer" src={logoUrl} />
        <div data-tauri-drag-region>
          <Typography component="strong" variant="subtitle2">
            Nexus
          </Typography>
          <Typography color="text.secondary" variant="caption">
            Live combat
          </Typography>
        </div>
        <Button color="inherit" onClick={() => closeWidget.mutate()} size="small" variant="text">
          Close
        </Button>
      </header>
      <Card className="widget-runtime-card">
        <Stack spacing={1.5}>
          <div className="widget-runtime-stat">
            <Typography color="text.secondary" variant="caption">
              Visible damage
            </Typography>
            <Typography variant="h5">{Math.round(totalDamage).toLocaleString()}</Typography>
          </div>
          <div className="widget-runtime-stat">
            <Typography color="text.secondary" variant="caption">
              Leader
            </Typography>
            <Typography variant="body1">{leader?.name ?? "No combatant"}</Typography>
            <LinearProgress
              aria-label="leader damage share"
              value={Math.max(((leader?.totalDamage ?? 0) / maxDamage) * 100, leader ? 4 : 0)}
              variant="determinate"
            />
          </div>
          <div className="widget-runtime-grid">
            <div>
              <Typography color="text.secondary" variant="caption">
                Lines
              </Typography>
              <Typography>{(preview.data?.lineCount ?? 0).toLocaleString()}</Typography>
            </div>
            <div>
              <Typography color="text.secondary" variant="caption">
                Review
              </Typography>
              <Typography>{(preview.data?.failedCount ?? 0).toLocaleString()}</Typography>
            </div>
          </div>
        </Stack>
      </Card>
    </main>
  );
}
