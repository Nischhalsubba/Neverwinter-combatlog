import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHashRouter, RouterProvider } from "react-router-dom";
import "./material";
import { AppLayout } from "./app/layout/AppLayout";
import { routes } from "./app/routes/routes";
import "./theme/global.css";

const queryClient = new QueryClient();

const router = createHashRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: routes,
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
