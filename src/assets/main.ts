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
import darkCss from "highlight.js/styles/atom-one-dark.css?inline";
import lightCss from "highlight.js/styles/atom-one-light.css?inline";

(window as unknown as Record<string, unknown>).showToast = showToast;
window.Alpine = Alpine;

Alpine.data("dropdown", dropdown);
Alpine.data("colorSchemeSwitcher", colorSchemeSwitcher);
Alpine.data("upvote", upvote);
Alpine.data("share", share);
Alpine.data("uiPermission", uiPermission);

if (document.querySelector("[x-data]")) Alpine.start();

// ── highlight.js: dual-theme via CSS cascade ──────────────────────

function scopeCss(css: string, prefix: string): string {
  return css.replace(/([^{}]+)\{([^{}]*)\}/g, (_m: string, s: string, p: string) => {
    return s.replace(/[;{}]/g, "").trim().split(",").map(s=>s.trim()).filter(Boolean).map(s=>`${prefix} ${s}`).join(", ") + ` {${p}}`;
  });
}

function injectStyle(css: string, id: string): void {
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (el) { el.textContent = css; return; }
  el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

function applyHljsThemes(): void {
  injectStyle(scopeCss(lightCss, ":root:not(.dark)"), "hljs-light");
  injectStyle(scopeCss(darkCss, ":root.dark"), "hljs-dark");
}

// ── Init ──────────────────────────────────────────────────────────

const init = async () => {
  applyHljsThemes();
  hljs.highlightAll();
  initImagePreview();
  generateToc("content", ".toc", ".toc-container");
  initPjax();

  // Watch <html> class changes for dark/light toggle
  var mo = new MutationObserver(function() { applyHljsThemes(); hljs.highlightAll(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
