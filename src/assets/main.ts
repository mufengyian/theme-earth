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
import { ensureReady as shikiReady, highlightAll as shikiHighlight } from "./utils/shiki";

(window as unknown as Record<string, unknown>).showToast = showToast;
window.Alpine = Alpine;

Alpine.data("dropdown", dropdown);
Alpine.data("colorSchemeSwitcher", colorSchemeSwitcher);
Alpine.data("upvote", upvote);
Alpine.data("share", share);
Alpine.data("uiPermission", uiPermission);

if (document.querySelector("[x-data]")) Alpine.start();

// ── Code block toolbar (copy + collapse) ──────────────────────────

function enhanceCodeBlocks(): void {
  document.querySelectorAll("pre.shiki:not([data-enhanced])").forEach(function(pre) {
    pre.setAttribute("data-enhanced", "true");

    var wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";
    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    var toolbar = document.createElement("div");
    toolbar.className = "code-toolbar";

    // Copy
    var copyBtn = document.createElement("button");
    copyBtn.className = "code-btn";
    copyBtn.innerHTML = '<span class="icon">⎘</span> Copy';
    copyBtn.addEventListener("click", function() {
      var code = pre.querySelector("code");
      var text = code ? code.textContent || "" : pre.textContent || "";
      navigator.clipboard.writeText(text).then(function() {
        copyBtn.classList.add("copied");
        copyBtn.innerHTML = '<span class="icon">✓</span> Copied!';
        setTimeout(function() {
          copyBtn.classList.remove("copied");
          copyBtn.innerHTML = '<span class="icon">⎘</span> Copy';
        }, 2000);
      }).catch(function(){});
    });
    toolbar.appendChild(copyBtn);

    // Collapse (if tall)
    var h = pre.offsetHeight;
    if (h > 450) {
      wrapper.classList.add("is-collapsed");
      var collapseBtn = document.createElement("button");
      collapseBtn.className = "code-btn";
      collapseBtn.innerHTML = '<span class="icon">▼</span> Expand';
      collapseBtn.addEventListener("click", function() {
        var e = wrapper.classList.contains("is-expanded");
        wrapper.classList.remove("is-collapsed", "is-expanded");
        wrapper.classList.add(e ? "is-collapsed" : "is-expanded");
        collapseBtn.innerHTML = e
          ? '<span class="icon">▼</span> Expand'
          : '<span class="icon">▲</span> Collapse';
      });
      toolbar.insertBefore(collapseBtn, copyBtn);
    }

    wrapper.parentNode?.insertBefore(toolbar, wrapper);
  });
}

// ── Init ──────────────────────────────────────────────────────────

const init = async () => {
  shikiReady();
  await shikiHighlight();
  enhanceCodeBlocks();
  initImagePreview();
  generateToc("content", ".toc", ".toc-container");
  initPjax();

  // Re-render Shiki blocks when user switches dark/light mode
  var mo = new MutationObserver(function() {
    shikiHighlight().then(function() { enhanceCodeBlocks(); });
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
