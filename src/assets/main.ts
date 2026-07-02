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

// ── Code block enhancements (copy + collapse) ─────────────────────

function enhanceCodeBlocks(): void {
  document.querySelectorAll("pre:not([data-enhanced])").forEach((pre) => {
    pre.setAttribute("data-enhanced", "true");

    // Toolbar
    var toolbar = document.createElement("div");
    toolbar.className = "code-toolbar";

    // Collapse button (only if tall)
    var wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper is-collapsed";
    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    var collapseBtn = document.createElement("button");
    collapseBtn.className = "code-btn";
    collapseBtn.innerHTML = '<span class="icon">▼</span> Expand';
    collapseBtn.addEventListener("click", function () {
      var expanded = wrapper.classList.toggle("is-expanded");
      wrapper.classList.toggle("is-collapsed", !expanded);
      collapseBtn.innerHTML = expanded
        ? '<span class="icon">▲</span> Collapse'
        : '<span class="icon">▼</span> Expand';
    });
    toolbar.appendChild(collapseBtn);

    // Copy button
    var copyBtn = document.createElement("button");
    copyBtn.className = "code-btn";
    copyBtn.innerHTML = '<span class="icon">⎘</span> Copy';
    copyBtn.addEventListener("click", function () {
      var code = pre.querySelector("code");
      var text = code ? code.textContent || "" : pre.textContent || "";
      navigator.clipboard.writeText(text).then(function () {
        copyBtn.classList.add("copied");
        copyBtn.innerHTML = '<span class="icon">✓</span> Copied!';
        setTimeout(function () {
          copyBtn.classList.remove("copied");
          copyBtn.innerHTML = '<span class="icon">⎘</span> Copy';
        }, 2000);
      }).catch(function () {});
    });
    toolbar.insertBefore(copyBtn, collapseBtn);
    wrapper.parentNode?.insertBefore(toolbar, wrapper);
  });
}

// ── Init ──────────────────────────────────────────────────────────

const init = async () => {
  applyHljsThemes();
  hljs.highlightAll();
  enhanceCodeBlocks();
  initImagePreview();
  generateToc("content", ".toc", ".toc-container");
  initPjax();

  // Watch <html> class changes for dark/light toggle
  var mo = new MutationObserver(function() { applyHljsThemes(); hljs.highlightAll(); enhanceCodeBlocks(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
