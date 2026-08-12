import React from "react";
import ReactDOM from "react-dom/client";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "./app/layout/AppLayout";
import { routes } from "./app/routes/routes";
import { WidgetRuntimeScreen } from "./features/widget/WidgetRuntimeScreen";
import { muiTheme } from "./theme/muiTheme";
import "./theme/global.css";

const queryClient = new QueryClient();

const router = createHashRouter([
  { path: "/widget-runtime", element: <WidgetRuntimeScreen /> },
  {
    path: "/",
    element: <AppLayout />,
    children: routes,
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
<React.StrictMode>
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
