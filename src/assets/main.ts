import "./styles/tailwind.css";
import "./styles/main.css";
import "./styles/markdown-body.css";
import "./styles/moment.css";
import "./styles/image-preview.css";
import Alpine from "alpinejs";
import colorSchemeSwitcher from "./alpine-data/color-scheme-switcher";
import dropdown from "./alpine-data/dropdown";
import share from "./alpine-data/share";
import uiPermission from "./alpine-data/ui-permission";
import upvote from "./alpine-data/upvote";
import "./components/number-formatter";
import { initImagePreview } from "./utils/preview-core";
import { generateToc } from "./utils/toc";
import { showToast } from "./utils/toast";
import { initPjax } from "./utils/pjax";

import hljs from "highlight.js";


(window as unknown as Record<string, unknown>).showToast = showToast;
window.Alpine = Alpine;
Alpine.data("dropdown", dropdown);
Alpine.data("colorSchemeSwitcher", colorSchemeSwitcher);
Alpine.data("upvote", upvote);
Alpine.data("share", share);
Alpine.data("uiPermission", uiPermission);
if (document.querySelector("[x-data]")) Alpine.start();

const loadHljsTheme = (theme) => {
  var link = document.getElementById("hljs-theme");
  if (!link) {
    link = document.createElement("link");
    link.id = "hljs-theme";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = "/themes/theme-earthquake/assets/highlight-" + (theme || "atom-one-dark") + ".css";
};

const init = () => {
  initImagePreview();
  generateToc("content", ".toc", ".toc-container");
  loadHljsTheme(window.codeHighlightTheme);
  hljs.highlightAll();
  initPjax();
};
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
