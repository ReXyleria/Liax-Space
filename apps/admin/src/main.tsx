import React from "react";
import { createRoot } from "react-dom/client";

import "../../../packages/ui/src/tokens.css";
import "../../../packages/ui/src/base.css";
import "../../../packages/ui/src/components/button.css";
import "../../../packages/ui/src/components/card.css";
import "../../../packages/ui/src/components/form.css";
import "../../../packages/ui/src/components/link.css";
import "./styles/global.css";
import { App } from "./App";
import { LanguageWipeProvider } from "./effects/language-wipe/LanguageWipeProvider";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Admin root element was not found.");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <LanguageWipeProvider>
      <App />
    </LanguageWipeProvider>
  </React.StrictMode>
);
