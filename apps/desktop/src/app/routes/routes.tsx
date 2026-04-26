import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, type RouteObject } from "react-router-dom";
import { LiveScreen } from "../../features/live/LiveScreen";

const PlayerDetailScreen = lazy(() => import("../../features/live/PlayerDetailScreen").then((module) => ({ default: module.PlayerDetailScreen })));
const ReplayScreen = lazy(() => import("../../features/replay/ReplayScreen").then((module) => ({ default: module.ReplayScreen })));
const EncountersScreen = lazy(() => import("../../features/encounters/EncountersScreen").then((module) => ({ default: module.EncountersScreen })));
const EncounterDetailScreen = lazy(() => import("../../features/encounters/EncounterDetailScreen").then((module) => ({ default: module.EncounterDetailScreen })));
const WidgetBuilderScreen = lazy(() => import("../../features/widget/WidgetBuilderScreen").then((module) => ({ default: module.WidgetBuilderScreen })));
const SettingsScreen = lazy(() => import("../../features/settings/SettingsScreen").then((module) => ({ default: module.SettingsScreen })));

function lazyRoute(element: ReactNode) {
  return <Suspense fallback={<div className="route-loading">Loading workspace...</div>}>{element}</Suspense>;
}

export const routes: RouteObject[] = [
  { index: true, element: <Navigate to="/live" replace /> },
  { path: "live", element: <LiveScreen /> },
  { path: "live/players/:playerName", element: lazyRoute(<PlayerDetailScreen />) },
  { path: "replay", element: lazyRoute(<ReplayScreen />) },
  { path: "encounters", element: lazyRoute(<EncountersScreen />) },
  { path: "encounters/:encounterId", element: lazyRoute(<EncounterDetailScreen />) },
  { path: "widget", element: lazyRoute(<WidgetBuilderScreen />) },
  { path: "settings", element: lazyRoute(<SettingsScreen />) },
];
