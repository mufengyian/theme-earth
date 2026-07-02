import type { PreviewMode, PreviewItem } from "./preview-types";
import { i18n } from "./preview-i18n";
import {
  readText, readAllText, getImageSrc, getImageThumb,
  getElementImage, getPreviewElements, createIconButton, createMetaItem,
  lockPageScroll, ensurePreviewElements, setCloseHandler, setNavHandlers,
  bindPreviewEvents, escapeCssUrl, setPointerStart,
} from "./preview-dom";
import { installFocusTrap, cleanupFocusTrap } from "./preview-focus";

const SEL = ".markdown-body img, .moment-media img, #photo-detail-image";
const GALLERY_SEL = "#photos-gallery .photo-gallery-link";

let items: PreviewItem[] = [], idx = 0, mode: PreviewMode = "content", open = false;
let trigger: HTMLElement | null = null;
let unlockScroll: (() => void) | undefined;
let closeTimer: number | undefined;
let abort: AbortController | null = null;
let railCache = "";

const rd = (el: Element, s: string) => el.querySelector(s)?.textContent?.trim() ?? "";
const rdAll = (el: Element, s: string) => Array.from(el.querySelectorAll(s)).map(e=>e.textContent?.trim()??"").filter(Boolean);

const getGalleryItems = () => Array.from(document.querySelectorAll<HTMLElement>(GALLERY_SEL));

const makeGalleryItem = (el: HTMLElement): PreviewItem | null => {
  const src = getImageSrc(el); if (!src) return null;
  const img = getElementImage(el);
  const d = { title: rd(el,".photo-data-title")||img?.alt?.trim()||i18n("page.photos.photo","Photo"), description: rd(el,".photo-data-description"), detailUrl: rd(el,".photo-detail-url"), fullUrl: rd(el,".photo-full-url")||getImageSrc(el), groupName: rd(el,".photo-group-name"), groupUrl: rd(el,".photo-group-url"), date: rd(el,".photo-data-date"), camera: rd(el,".photo-data-camera"), tags: rdAll(el,".photo-data-tag"), meta: rdAll(el,".photo-meta-item") };
  return { src, thumb: getImageThumb(el,src), alt: img?.alt||d.title, ...d, element: el } as PreviewItem;
};

const makeContentItem = (img: HTMLImageElement): PreviewItem | null => {
  const src = getImageSrc(img); if (!src) return null;
  const t = img.alt?.trim()||img.getAttribute("title")?.trim()||i18n("page.photos.photo","Photo");
  return { src, thumb: getImageThumb(img,src), alt: img.alt||t, title: t, description:"", detailUrl:"", fullUrl:src, groupName:"", groupUrl:"", date:"", camera:"", tags:[], meta:[], element: img };
};

const collectGallery = () => getGalleryItems().map(makeGalleryItem).filter((i): i is PreviewItem => !!i);
const collectContent = (img: HTMLImageElement) => {
  const g = img.closest<HTMLElement>(".moment-media")||img.closest<HTMLElement>(".markdown-body");
  const imgs = g ? Array.from(g.querySelectorAll<HTMLImageElement>("img")) : [img];
  return imgs.map(makeContentItem).filter((i): i is PreviewItem => !!i);
};

const rMeta = (item: PreviewItem) => {
  const els = getPreviewElements(); if (!els) return;
  els.meta.textContent = "";
  const entries: any[] = [];
  if (item.date) entries.push({icon:"icon-[tabler--calendar]",value:item.date});
  if (item.camera) entries.push({icon:"icon-[tabler--camera]",value:item.camera});
  if (item.groupName) entries.push({icon:"icon-[tabler--folder]",value:item.groupName,href:item.groupUrl});
  item.tags.forEach(t=>entries.push({icon:"icon-[tabler--tag]",value:t}));
  item.meta.forEach(m=>entries.push({icon:"icon-[tabler--info-circle]",value:m}));
  entries.forEach(e=>els.meta.append(createMetaItem(e.icon,e.value,e.href)));
  els.meta.hidden = entries.length === 0;
};

const rActions = (item: PreviewItem) => {
  const els = getPreviewElements(); if (!els) return;
  els.actions.textContent = "";
  const u = item.fullUrl||item.src;
  if (u) els.actions.append(createIconButton("icon-[tabler--download]",i18n("page.photos.download","Download"),()=>{},u));
  if (navigator.share&&u) els.actions.append(createIconButton("icon-[tabler--share-3]",i18n("page.photos.share","Share"),()=>{void navigator.share({title:item.title,text:item.description,url:u});}));
  if (item.detailUrl) els.actions.append(createIconButton("icon-[tabler--external-link]",i18n("page.photos.viewDetail","Detail"),()=>{},item.detailUrl));
};

const preload = (src: string) => { if (!src) return; const i=new Image(); i.decoding="async"; i.src=src; void i.decode?.().catch(()=>{}); };

export const goToPreview = (n: number) => {
  if (n < 0 || n >= items.length || n === idx) return;
  idx = n; render();
};

const rRail = () => {
  const els = getPreviewElements(); if (!els) return;
  const k = items.map(i=>i.src).join("|");
  if (k !== railCache) {
    els.rail.textContent = ""; railCache = k;
    if (items.length <= 1) { els.rail.hidden = true; return; }
    els.rail.hidden = false;
    items.forEach((item, i) => {
      const b = document.createElement("button");
      b.type="button"; b.className="earthquake-preview__thumb"; b.dataset.previewIndex=String(i);
      b.setAttribute("aria-label",`${i18n("page.photos.selectPhoto","Select")} ${i+1}`);
      const img = document.createElement("img"); img.src=item.thumb||item.src; img.alt=""; img.loading="lazy";
      b.append(img);
      b.addEventListener("click",()=>goToPreview(i));
      els.rail.append(b);
    });
  }
  const thumbs = els.rail.querySelectorAll<HTMLElement>(".earthquake-preview__thumb");
  thumbs.forEach((b,i)=>{ b.classList.toggle("is-active",i===idx); b.setAttribute("aria-current",i===idx?"true":"false"); });
  const a = thumbs[idx]; if (a) a.scrollIntoView({block:"nearest",inline:"center"});
};

function render() {
  const els = getPreviewElements(); const item = items[idx];
  if (!els || !item) return;
  els.root.style.setProperty("--earthquake-preview-image",`url("${escapeCssUrl(item.thumb||item.src)}")`);
  els.root.classList.toggle("is-gallery",mode==="gallery");
  els.root.classList.add("is-loading"); els.image.src=item.src; els.image.alt=item.alt;
  if (els.image.complete&&els.image.naturalWidth>0) { abort?.abort(); abort=null; els.root.classList.remove("is-loading"); }
  else { abort?.abort(); abort=new AbortController(); const s=abort.signal; const done=()=>{els.root.classList.remove("is-loading");abort?.abort();abort=null;}; els.image.addEventListener("load",done,{signal:s}); els.image.addEventListener("error",done,{signal:s}); }
  els.title.textContent=item.title; els.description.textContent=item.description; els.description.hidden=!item.description;
  els.counter.textContent=`${idx+1}/${items.length}`;
  els.previousButton.disabled=idx===0; els.nextButton.disabled=idx===items.length-1;
  els.previousButton.hidden=items.length<=1; els.nextButton.hidden=items.length<=1;
  rMeta(item); rActions(item); rRail();
  [idx-1,idx+1].forEach(i=>{const i2=items[i];if(i2)preload(i2.src);});
}

function close() {
  const els = getPreviewElements(); if (!els || !open) return;
  open = false; setPointerStart(null); els.root.classList.remove("is-open");
  unlockScroll?.(); unlockScroll = undefined;
  document.documentElement.classList.remove("image-preview-open");
  abort?.abort(); abort = null; cleanupFocusTrap();
  if (trigger?.isConnected) trigger.focus({preventScroll:true}); trigger=null;
  railCache = ""; if (closeTimer) window.clearTimeout(closeTimer);
  closeTimer = window.setTimeout(() => { if (!open) els.root.hidden = true; }, 180);
}

export const openPreview = (newItems: PreviewItem[], index: number, newMode: PreviewMode, trg?: HTMLElement | null) => {
  const els = ensurePreviewElements();
  if (newItems.length === 0 || index < 0) return;
  const si = Math.max(0, Math.min(index, newItems.length-1));
  if (closeTimer) { window.clearTimeout(closeTimer); closeTimer = undefined; }
  items = newItems; idx = si; mode = newMode; open = true; trigger = trg ?? null;
  els.root.hidden = false; unlockScroll?.(); unlockScroll = lockPageScroll();
  document.documentElement.classList.add("image-preview-open");
  render();
  window.requestAnimationFrame(() => { els.root.classList.add("is-open"); els.closeButton.focus({preventScroll:true}); installFocusTrap(()=>open); });
};

const onClick = (e: MouseEvent) => {
  if (e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
  const t = e.target; if (!(t instanceof Element)||t.closest(".earthquake-preview")) return;
  const g = t.closest<HTMLElement>(GALLERY_SEL);
  if (g) { e.preventDefault(); e.stopImmediatePropagation(); const its=collectGallery(); openPreview(its,its.findIndex(i=>i.element===g),"gallery",g); return; }
  const c = t.closest<HTMLElement>("[data-preview-src]");
  if (c) { e.preventDefault(); e.stopImmediatePropagation(); const img=getElementImage(c); const src=c.dataset.previewSrc||(img?.src||""); if(src) openPreview([{src,thumb:getImageThumb(c,src),alt:c.dataset.previewAlt||img?.alt||"",title:c.dataset.previewTitle||c.getAttribute("aria-label")||c.getAttribute("title")||img?.alt||i18n("page.photos.photo","Photo"),description:"",detailUrl:"",fullUrl:src,groupName:"",groupUrl:"",date:"",camera:"",tags:[],meta:[],element:c}],0,"content",c); return; }
  const img = t.closest<HTMLImageElement>(SEL); if (!img) return;
  const its = collectContent(img); const i = its.findIndex(it=>it.element===img);
  e.preventDefault(); e.stopImmediatePropagation(); openPreview(its,i,"content",img as HTMLElement);
};

const onKey = (e: KeyboardEvent) => {
  if (!open) return;
  if (e.key==="Escape") { e.preventDefault(); close(); }
  else if (e.key==="ArrowLeft") { e.preventDefault(); goToPreview(idx-1); }
  else if (e.key==="ArrowRight") { e.preventDefault(); goToPreview(idx+1); }
};

let cleanupClick: (()=>void)|undefined, cleanupKey: (()=>void)|undefined;

export const initImagePreview = () => {
  cleanupClick?.(); cleanupKey?.();
  const els = ensurePreviewElements();
  setCloseHandler(close);
  setNavHandlers(()=>goToPreview(idx-1),()=>goToPreview(idx+1));
  bindPreviewEvents();
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey);
  cleanupClick = () => document.removeEventListener("click", onClick, true);
  cleanupKey = () => document.removeEventListener("keydown", onKey);
};
