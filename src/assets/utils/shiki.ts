/**
 * src/assets/utils/shiki.ts
 *
 * Shiki browser-side code highlighter.
 *
 * - Single shared highlighter via getSingletonHighlighter()
 * - Dual theme: github-dark / github-light (CSS variable auto-switch)
 * - 17 languages pre-registered for blog use
 * - Preload on page load → first paint shows highlighted code
 * - highlightAll() finds <pre><code> blocks, replaces with Shiki output
 * - No Web Component / LitElement — pure DOM API
 */

import {
  getSingletonHighlighter,
  type Highlighter,
  type HighlighterGeneric,
} from "shiki";

/* -------------------------------------------------------------------------- *
 *  Config
 * -------------------------------------------------------------------------- */

const DARK_THEME = "github-dark";
const LIGHT_THEME = "github-light";

/**
 * Languages to load into the highlighter.
 *
 * `shell` is a Shiki alias for `bash` — loading `bash` covers it.
 * Total: 17 unique language IDs.
 */
const LANGS = [
  "javascript",
  "typescript",
  "python",
  "bash",
  "go",
  "rust",
  "sql",
  "json",
  "yaml",
  "css",
  "html",
  "xml",
  "markdown",
  "diff",
  "dockerfile",
  "nginx",
  "ini",
] as const;

/** Alias map: blog markdown may use short names. */
const ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  shell: "bash",
  sh: "bash",
  zsh: "bash",
  py: "python",
  golang: "go",
  rs: "rust",
  yml: "yaml",
  md: "markdown",
  docker: "dockerfile",
};

/* -------------------------------------------------------------------------- *
 *  State
 * -------------------------------------------------------------------------- */

let highlighter: HighlighterGeneric<string, string> | null = null;
let readyPromise: Promise<void> | null = null;

/* -------------------------------------------------------------------------- *
 *  Init / Preload
 * -------------------------------------------------------------------------- */

/**
 * Initialise the singleton highlighter (idempotent).
 *
 *   1. getSingletonHighlighter()
 *   2. Load both themes (github-dark, github-light)
 *   3. Load all 17 languages in parallel
 *   4. Warm-up — run codeToHtml once to trigger JIT compilation
 *
 * Call ensureReady() to start the promise; highlightAll() awaits it.
 */
export function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = init();
  }
  return readyPromise;
}

async function init(): Promise<void> {
  highlighter = await getSingletonHighlighter();

  // Load both themes
  await highlighter.loadTheme(DARK_THEME, LIGHT_THEME);

  // Load all languages in parallel
  await Promise.all(
    LANGS.map((lang) => highlighter!.loadLanguage(lang)),
  );

  // Warm-up: trigger JIT so first real code block renders instantly
  highlighter.codeToHtml("const x = 1", {
    lang: "javascript",
    themes: { dark: DARK_THEME, light: LIGHT_THEME },
  });
}

/* -------------------------------------------------------------------------- *
 *  Highlight
 * -------------------------------------------------------------------------- */

/**
 * Resolve a language name from a <code> element's class list.
 * Returns null if the language is not in our supported set.
 */
function resolveLang(className: string): string | null {
  const match = className.match(/(?:language-|lang-)([\w-]+)/);
  if (!match) return null;
  const raw = match[1].toLowerCase();
  if (ALIASES[raw]) return ALIASES[raw];
  if ((LANGS as readonly string[]).includes(raw)) return raw;
  return null;
}

/**
 * Highlight every <pre><code> block on the page that hasn't been
 * processed yet (marked with data-shiki).
 *
 * For each block:
 *   1. Extract raw code text and language
 *   2. If language is supported, call codeToHtml() and replace the <pre>
 *   3. Mark with data-shiki="done" to avoid re-processing
 *
 * Pjax-safe: only touches <pre> without data-shiki attribute.
 */
export async function highlightAll(): Promise<void> {
  await ensureReady();

  const h = highlighter;
  if (!h) return;

  const blocks = document.querySelectorAll<HTMLPreElement>(
    "pre:not([data-shiki])",
  );

  for (const pre of blocks) {
    pre.setAttribute("data-shiki", "pending");

    const codeEl = pre.querySelector("code");
    if (!codeEl) {
      pre.setAttribute("data-shiki", "skip");
      continue;
    }

    const code = codeEl.textContent ?? "";
    const lang = resolveLang(codeEl.className);

    if (!lang || !code.trim()) {
      pre.setAttribute("data-shiki", "skip");
      continue;
    }

    try {
      const html = h.codeToHtml(code, {
        lang,
        themes: { dark: DARK_THEME, light: LIGHT_THEME },
      });

      // Parse the Shiki output and replace the original <pre>
      const template = document.createElement("template");
      template.innerHTML = html.trim();
      const newPre = template.content.querySelector("pre");
      if (newPre) {
        // Preserve original classes (e.g. language-xxx for toolbar)
        for (const cls of pre.classList) {
          if (!newPre.classList.contains(cls)) {
            newPre.classList.add(cls);
          }
        }
        newPre.setAttribute("data-shiki", "done");
        pre.replaceWith(newPre);
      } else {
        pre.setAttribute("data-shiki", "skip");
      }
    } catch {
      pre.setAttribute("data-shiki", "skip");
    }
  }
}

/**
 * Re-highlight after a Pjax content swap.
 * Alias for highlightAll() — finds new <pre> blocks without data-shiki.
 */
export function refresh(): Promise<void> {
  return highlightAll();
}
