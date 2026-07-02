import { getPreviewElements } from "./preview-dom";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let _cleanup: (() => void) | undefined;

export const installFocusTrap = (isOpen: () => boolean) => {
  _cleanup?.(); _cleanup = undefined;
  const root = getPreviewElements()?.root;
  if (!root) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key !== "Tab" || !isOpen()) return;
    const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
    else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
  };
  root.addEventListener("keydown", handler);
  _cleanup = () => root.removeEventListener("keydown", handler);
};

export const cleanupFocusTrap = () => { _cleanup?.(); _cleanup = undefined; };
