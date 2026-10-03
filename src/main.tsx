import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { TooltipProvider } from "./components/ui/tooltip.tsx";
import { AuthProvider } from "./hooks/useAuth.tsx";
import { initTheme } from "./lib/theme.ts";
import { ensureServerAwake, startWakeKeepalive } from "./lib/wakeServer.ts";

initTheme();
// Kick Render free-tier wake as early as possible (before React paints).
void ensureServerAwake();
startWakeKeepalive();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <TooltipProvider delayDuration={200}>
        <App />
      </TooltipProvider>
    </AuthProvider>
  </StrictMode>
);
