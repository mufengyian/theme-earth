import type { PreviewElements } from "./preview-types";
import { i18n } from "./preview-i18n";

export const readText = (root: Element, selector: string): string =>
  root.querySelector(selector)?.textContent?.trim() ?? "";

export const readAllText = (root: Element, selector: string): string[] =>
  Array.from(root.querySelectorAll(selector))
    .map((el) => el.textContent?.trim() ?? "")
    .filter(Boolean);

export const escapeCssUrl = (url: string): string =>
  url.replace(/["\\]/g, "\\$&");

export const isLikelyImageUrl = (url: string): boolean =>
  /^data:image\\//i.test(url) ||
  /\\.(apng|avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(url);

export const getElementImage = (element: HTMLElement): HTMLImageElement | null =>
  element instanceof HTMLImageElement
    ? element
    : element.querySelector<HTMLImageElement>("img");

export const getImageSrc = (element: HTMLElement): string => {
  if (element.dataset.previewSrc) return element.dataset.previewSrc;
  if (element instanceof HTMLImageElement) {
    const link = element.closest<HTMLAnchorElement>("a[href]");
    if (link?.href && isLikelyImageUrl(link.href)) return link.href;
    return element.src || element.currentSrc;
  }
  if (element instanceof HTMLAnchorElement && element.href) return element.href;
  const img = element.querySelector<HTMLImageElement>("img");
  return img?.src || img?.currentSrc || "";
};

export const getImageThumb = (element: HTMLElement, src: string): string => {
  const img = getElementImage(element);
  return img?.currentSrc || img?.src || src;
};

export const lockPageScroll = (): (() => void) => {
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;
  const sbw = window.innerWidth - document.documentElement.clientWidth;
  const hOvf = document.documentElement.style.overflow;
  const hPad = document.documentElement.style.paddingRight;
  const bOvf = document.body.style.overflow;
  const bPad = document.body.style.paddingRight;
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  if (sbw > 0) {
    document.documentElement.style.paddingRight = `${sbw}px`;
    document.body.style.paddingRight = `${sbw}px`;
  }
  return () => {
    document.documentElement.style.overflow = hOvf;
    document.documentElement.style.paddingRight = hPad;
    document.body.style.overflow = bOvf;
    document.body.style.paddingRight = bPad;
    window.scrollTo(scrollX, scrollY);
  };
};

export const createIconButton = (icon: string, label: string, onClick: () => void, href?: string): HTMLElement => {
  const el = href ? document.createElement("a") : document.createElement("button");
  el.className = "earthquake-preview__action";
  el.setAttribute("aria-label", label);
  el.setAttribute("title", label);
  if (href && el instanceof HTMLAnchorElement) { el.href = href; el.target = "_blank"; el.rel = "noopener noreferrer"; }
  else if (el instanceof HTMLButtonElement) el.type = "button";
  const span = document.createElement("span");
  span.className = icon;
  span.setAttribute("aria-hidden", "true");
  el.append(span);
  el.addEventListener("click", (e) => { if (!href) e.preventDefault(); onClick(); });
  return el;
};

export const createMetaItem = (icon: string, value: string, href?: string): HTMLElement => {
  const el = href ? document.createElement("a") : document.createElement("span");
  el.className = "earthquake-preview__meta-item";
  const i = document.createElement("span");
  i.className = icon; i.setAttribute("aria-hidden", "true");
  const v = document.createElement("span");
  v.textContent = value;
  el.append(i, v);
  if (href && el instanceof HTMLAnchorElement) el.href = href;
  return el;
};

let _cleanupBind: (() => void) | undefined;
let _onClose: (() => void) | null = null;
let _onPrev: (() => void) | null = null;
let _onNext: (() => void) | null = null;
let _pointerStart: { x: number; y: number } | null = null;
let _elements: PreviewElements | null = null;

export const getPreviewElements = () => _elements;
export const setCloseHandler = (fn: () => void) => { _onClose = fn; };
export const setNavHandlers = (prev: () => void, next: () => void) => { _onPrev = prev; _onNext = next; };
export const setPointerStart = (p: { x: number; y: number } | null) => { _pointerStart = p; };

export const ensurePreviewElements = (): PreviewElements => {
  if (_elements && document.body.contains(_elements.root)) return _elements;
  const root = document.createElement("div");
  root.className = "earthquake-preview"; root.hidden = true; root.tabIndex = -1;
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", i18n("page.photos.preview", "Image preview"));
  const backdrop = document.createElement("div");
  backdrop.className = "earthquake-preview__backdrop"; backdrop.dataset.previewClose = "";
  const viewport = document.createElement("div");
  viewport.className = "earthquake-preview__viewport";
  const _c = () => { const e=document.createElement("div"); e.className="earthquake-preview__counter"; return e; };
  const counter = _c();
  const closeBtn = (() => { const b=document.createElement("button"); b.className="earthquake-preview__close"; b.type="button"; b.dataset.previewClose=""; b.setAttribute("aria-label", i18n("common.close","Close")); const s=document.createElement("span"); s.className="icon-[tabler--x]"; s.setAttribute("aria-hidden","true"); b.append(s); return b; })();
  const prevBtn = (() => { const b=document.createElement("button"); b.className="earthquake-preview__nav earthquake-preview__nav--previous"; b.type="button"; b.dataset.previewPrevious=""; b.setAttribute("aria-label", i18n("pagination.previous","Previous")); const s=document.createElement("span"); s.className="icon-[tabler--chevron-left]"; s.setAttribute("aria-hidden","true"); b.append(s); return b; })();
  const nextBtn = (() => { const b=document.createElement("button"); b.className="earthquake-preview__nav earthquake-preview__nav--next"; b.type="button"; b.dataset.previewNext=""; b.setAttribute("aria-label", i18n("pagination.next","Next")); const s=document.createElement("span"); s.className="icon-[tabler--chevron-right]"; s.setAttribute("aria-hidden","true"); b.append(s); return b; })();
  const stage = document.createElement("div"); stage.className = "earthquake-preview__stage";
  const image = document.createElement("img"); image.className = "earthquake-preview__image"; image.alt = "";
  stage.append(image);
  const info = document.createElement("aside"); info.className = "earthquake-preview__info";
  const title = document.createElement("h2"); title.className = "earthquake-preview__title";
  const desc = document.createElement("p"); desc.className = "earthquake-preview__description";
  const meta = document.createElement("div"); meta.className = "earthquake-preview__meta";
  const actions = document.createElement("div"); actions.className = "earthquake-preview__actions";
  info.append(title, desc, meta, actions);
  const rail = document.createElement("div"); rail.className = "earthquake-preview__rail";
  viewport.append(counter, closeBtn, prevBtn, nextBtn, stage, info, rail);
  root.append(backdrop, viewport);
  document.body.append(root);
  _elements = { root, viewport, stage, image, title, description: desc, meta, actions, rail, counter, previousButton: prevBtn, nextButton: nextBtn, closeButton: closeBtn };
  return _elements;
};

export const bindPreviewEvents = () => {
  _cleanupBind?.(); _cleanupBind = undefined;
  const els = getPreviewElements(); if (!els) return;
  const closeList = els.root.querySelectorAll<HTMLElement>("[data-preview-close]");
  const onClose = () => _onClose?.();
  const onPrev = () => _onPrev?.();
  const onNext = () => _onNext?.();
  const onPD = (e: PointerEvent) => { if (!e.isPrimary) return; _pointerStart = { x: e.clientX, y: e.clientY }; };
  const onPU = (e: PointerEvent) => {
    if (!_pointerStart || !e.isPrimary) { _pointerStart = null; return; }
    const dx = e.clientX - _pointerStart.x;
    const dy = e.clientY - _pointerStart.y;
    _pointerStart = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    (dx < 0 ? onNext : onPrev)();
  };
  const onPC = () => { _pointerStart = null; };
  closeList.forEach((el) => el.addEventListener("click", onClose));
  els.previousButton.addEventListener("click", onPrev);
  els.nextButton.addEventListener("click", onNext);
  els.stage.addEventListener("pointerdown", onPD);
  els.stage.addEventListener("pointerup", onPU);
  els.stage.addEventListener("pointercancel", onPC);
  _cleanupBind = () => {
    closeList.forEach((el) => el.removeEventListener("click", onClose));
    els.previousButton.removeEventListener("click", onPrev);
    els.nextButton.removeEventListener("click", onNext);
    els.stage.removeEventListener("pointerdown", onPD);
    els.stage.removeEventListener("pointerup", onPU);
    els.stage.removeEventListener("pointercancel", onPC);
  };
};
