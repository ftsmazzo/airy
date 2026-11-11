import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OrbPreviewApp } from "./OrbPreviewApp";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OrbPreviewApp />
  </StrictMode>,
);
