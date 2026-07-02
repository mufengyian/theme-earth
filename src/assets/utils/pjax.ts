import { rafThrottle } from "./raf";
import { initImagePreview } from "./preview-core";
import { generateToc } from "./toc";

const MAIN = "main#main-content", LOAD = "pjax-loading", THRESH = 300;
let fetchCtrl: AbortController | null = null;
let scrollH: (() => void) | null = null;

function ok(link: HTMLAnchorElement): boolean {
  if (link.target === "_blank" || link.hasAttribute("download") || link.closest("[data-no-pjax]")) return false;
  const h = link.getAttribute("href"); if (!h || h.trim() === "" || h.startsWith("#")) return false;
  let u: URL; try { u = new URL(link.href); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.origin !== window.location.origin) return false;
  if (u.pathname === window.location.pathname && u.search === window.location.search) return false;
  return true;
}

async function nav(url: string, push: boolean) {
  if (fetchCtrl) fetchCtrl.abort();
  const ctrl = new AbortController(); fetchCtrl = ctrl;
  document.documentElement.classList.add(LOAD);
  try {
    const res = await fetch(url, { headers: { Accept: "text/html" }, credentials: "same-origin", signal: ctrl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const nm = doc.querySelector<HTMLElement>(MAIN);
    const cm = document.querySelector<HTMLElement>(MAIN);
    if (!nm || !cm) throw new Error("main not found");
    cm.replaceWith(nm);
    if (doc.title) document.title = doc.title;
    if (push) history.pushState({ url }, "", url);
    window.scrollTo(0, 0);
    initImagePreview(); generateToc("content", ".toc", ".toc-container");
    bindScroll();
    const m = document.querySelector(MAIN);
    if (m && (window as any).Alpine?.initTree) (window as any).Alpine.initTree(m);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    console.error("[Pjax]", err); window.location.href = url;
  } finally {
    if (fetchCtrl === ctrl) { fetchCtrl = null; document.documentElement.classList.remove(LOAD); }
  }
}

function bindScroll() {
  if (scrollH) window.removeEventListener("scroll", scrollH);
  const h = rafThrottle(() => {
    document.getElementById("header-menu")?.classList.toggle("menu-sticky", window.scrollY > 0);
    const bar = document.getElementById("reading-progress-bar");
    if (bar) { const fill = bar.querySelector(".reading-progress-fill") as HTMLElement; if (fill) { const dh = document.documentElement.scrollHeight - window.innerHeight; fill.style.width = dh > 0 ? Math.min(100, (window.scrollY / dh) * 100) + "%" : "0%"; } }
    const btn = document.getElementById("btn-scroll-to-top");
    if (btn) { btn.style.opacity = window.scrollY > THRESH ? "1" : "0"; btn.style.pointerEvents = window.scrollY > THRESH ? "auto" : "none"; }
  });
  window.addEventListener("scroll", h, { passive: true }); scrollH = h; h();
}

const onClick = (e: MouseEvent) => {
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
  const link = (e.target as Element)?.closest<HTMLAnchorElement>("a[href]");
  if (!link || !ok(link)) return;
  e.preventDefault(); nav(link.href, true);
};

export function initPjax() {
  const m = document.querySelector(MAIN); if (!m) { console.warn("[Pjax] no main"); return; }
  m.addEventListener("click", onClick);
  window.addEventListener("popstate", (e) => nav((e.state as any)?.url ?? window.location.href, false));
  history.replaceState({ url: window.location.href }, "", window.location.href);
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  bindScroll();
  document.getElementById("btn-scroll-to-top")?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  console.info("[Pjax] ready");
}
