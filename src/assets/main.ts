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

// highlight.js — 只注册博客用到的语言
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import nginx from "highlight.js/lib/languages/nginx";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import "highlight.js/styles/atom-one-dark.css";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("go", go);
hljs.registerLanguage("ini", ini);
hljs.registerLanguage("java", java);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("nginx", nginx);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);

(window as unknown as Record<string, unknown>).showToast = showToast;
window.Alpine = Alpine;

Alpine.data("dropdown", dropdown);
Alpine.data("colorSchemeSwitcher", colorSchemeSwitcher);
Alpine.data("upvote", upvote);
Alpine.data("share", share);
Alpine.data("uiPermission", uiPermission);

if (document.querySelector("[x-data]")) Alpine.start();

// ── Code block toolbar (copy button + auto-collapse long blocks) ──

function enhanceCodeBlocks(): void {
  document.querySelectorAll("pre:not([data-enhanced])").forEach(function(pre) {
    pre.setAttribute("data-enhanced", "true");

    // Wrapper for collapse
    var wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";
    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    // Toolbar
    var toolbar = document.createElement("div");
    toolbar.className = "code-toolbar";

    // Copy button
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

    // Only add collapse if tall enough
    var preHeight = pre.offsetHeight;
    var COLLAPSE_THRESHOLD = 450;
    if (preHeight > COLLAPSE_THRESHOLD) {
      wrapper.classList.add("is-collapsed");
      var collapseBtn = document.createElement("button");
      collapseBtn.className = "code-btn";
      collapseBtn.innerHTML = '<span class="icon">▼</span> Expand';
      collapseBtn.addEventListener("click", function() {
        var expanded = wrapper.classList.contains("is-expanded");
        wrapper.classList.remove("is-collapsed", "is-expanded");
        wrapper.classList.add(expanded ? "is-collapsed" : "is-expanded");
        collapseBtn.innerHTML = expanded
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
  hljs.highlightAll();
  enhanceCodeBlocks();
  initImagePreview();
  generateToc("content", ".toc", ".toc-container");
  initPjax();
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
