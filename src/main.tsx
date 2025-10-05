import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

registerSW({
  immediate: true,
  onNeedRefresh() {
    console.info("ICUPA update available. Reload to apply the latest experience.");
  },
  onOfflineReady() {
    console.info("ICUPA is ready to work offline.");
  },
});

createRoot(document.getElementById("root")!).render(<App />);
