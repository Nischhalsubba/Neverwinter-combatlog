import { Navigate, type RouteObject } from "react-router-dom";
import { LiveScreen } from "../../features/live/LiveScreen";
import { PlayerDetailScreen } from "../../features/live/PlayerDetailScreen";
import { ReplayScreen } from "../../features/replay/ReplayScreen";
import { EncountersScreen } from "../../features/encounters/EncountersScreen";
import { EncounterDetailScreen } from "../../features/encounters/EncounterDetailScreen";
import { WidgetBuilderScreen } from "../../features/widget/WidgetBuilderScreen";
import { SettingsScreen } from "../../features/settings/SettingsScreen";

export const routes: RouteObject[] = [
  { index: true, element: <Navigate to="/live" replace /> },
  { path: "live", element: <LiveScreen /> },
  { path: "live/players/:playerName", element: <PlayerDetailScreen /> },
  { path: "replay", element: <ReplayScreen /> },
  { path: "encounters", element: <EncountersScreen /> },
  { path: "encounters/:encounterId", element: <EncounterDetailScreen /> },
  { path: "widget", element: <WidgetBuilderScreen /> },
  { path: "settings", element: <SettingsScreen /> },
];
