import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { SpikePanel } from "@/spike/SpikePanel";
import "./styles.css";

const host = document.getElementById("root");
if (!host) throw new Error("theme studio: #root is missing from the panel document");

createRoot(host).render(
  <StrictMode>
    <SpikePanel />
  </StrictMode>,
);
