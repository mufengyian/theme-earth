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

const hljsThemes = import.meta.glob(
  ["highlight.js/styles/*.css", "!highlight.js/styles/base16*"],
  { query: "?inline", eager: false }
);

const loadHljsTheme = async (theme) => {
  var name = theme || "atom-one-dark";
  var path = Object.keys(hljsThemes).find(function(k) {
    return k.includes("/" + name + ".css");
  });
  if (path) {
    await hljsThemes[path]();
  }
  hljs.highlightAll();
};

const init = async () => {
  initImagePreview();
  generateToc("content", ".toc", ".toc-container");
  await loadHljsTheme(window.codeHighlightTheme);
  hljs.highlightAll();
  initPjax();
};
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
