import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import TabooApp from "../app/components/TabooApp";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TabooApp />
  </StrictMode>,
);
