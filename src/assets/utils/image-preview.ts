type PreviewMode = "content" | "gallery";

type PreviewItem = {
  src: string;
  thumb: string;
  alt: string;
  title: string;
  description: string;
  detailUrl: string;
  fullUrl: string;
  groupName: string;
  groupUrl: string;
  date: string;
  camera: string;
  tags: string[];
  meta: string[];
  element: HTMLElement;
};

type PreviewElements = {
  root: HTMLDivElement;
  viewport: HTMLDivElement;
  stage: HTMLDivElement;
  image: HTMLImageElement;
  title: HTMLHeadingElement;
  description: HTMLParagraphElement;
  meta: HTMLDivElement;
  actions: HTMLDivElement;
  rail: HTMLDivElement;
  counter: HTMLDivElement;
  previousButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
};

type PointerStart = {
  x: number;
  y: number;
};

const previewableImageSelector =
  ".markdown-body img, .moment-media img, #photo-detail-image";
const galleryItemSelector = "#photos-gallery .photo-gallery-link";

const i18n = (key: string, fallback: string) =>
  window.i18nResources?.[key] || fallback;

let previewElements: PreviewElements | null = null;
let previewItems: PreviewItem[] = [];
let previewIndex = 0;
let previewMode: PreviewMode = "content";
let previewOpen = false;
let pointerStart: PointerStart | null = null;
let closeTimer: number | undefined;
let cleanupDocumentClick: (() => void) | undefined;
let cleanupKeyboard: (() => void) | undefined;
let unlockPreviewPageScroll: (() => void) | undefined;

// AbortController for the current image load listener pair.
// renderPreview reassigns img.src on every switch; changing src cancels the
// pending request so the old load/error events never fire, which means the
// old onLoaded closure would otherwise linger forever (referencing
// elements.root). Aborting on each render keeps listeners bounded to one pair.
let imageLoadAbort: AbortController | null = null;

// Rail DOM cache: avoid rebuilding all thumbnails on every switch
let railCacheKey = "";
let railThumbButtons: HTMLButtonElement[] = [];

// Focus trap: track the element that opened the preview for focus restoration
let triggerElement: HTMLElement | null = null;
let cleanupFocusTrap: (() => void) | undefined;

const readText = (root: Element, selector: string) =>
  root.querySelector(selector)?.textContent?.trim() ?? "";

const readAllText = (root: Element, selector: string) =>
  Array.from(root.querySelectorAll(selector))
    .map((element) => element.textContent?.trim() ?? "")
    .filter(Boolean);

const queryRequired = <T extends Element>(
  root: ParentNode,
  selector: string,
) => {
  const element = root.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing image preview element: ${selector}`);
  }

  return element;
};

const escapeCssUrl = (url: string) => url.replace(/["\\]/g, "\\$&");

const isLikelyImageUrl = (url: string) =>
  /^data:image\//i.test(url) ||
  /\.(apng|avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(url);

const getElementImage = (element: HTMLElement) =>
  element instanceof HTMLImageElement
    ? element
    : element.querySelector<HTMLImageElement>("img");

const getImageSrc = (element: HTMLElement) => {
  if (element.dataset.previewSrc) {
    return element.dataset.previewSrc;
  }

  if (element instanceof HTMLImageElement) {
    const imageLink = element.closest<HTMLAnchorElement>("a[href]");

    if (imageLink?.href && isLikelyImageUrl(imageLink.href)) {
      return imageLink.href;
    }

    return element.src || element.currentSrc;
  }

  if (element instanceof HTMLAnchorElement && element.href) {
    return element.href;
  }

  const image = element.querySelector<HTMLImageElement>("img");
  return image?.src || image?.currentSrc || "";
};

const getImageThumb = (element: HTMLElement, src: string) => {
  const image = getElementImage(element);
  return image?.currentSrc || image?.src || src;
};

const lockPageScroll = () => {
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;
  const scrollbarWidth =
    window.innerWidth - document.documentElement.clientWidth;
  const htmlStyles = {
    overflow: document.documentElement.style.overflow,
    paddingRight: document.documentElement.style.paddingRight,
  };
  const bodyStyles = {
    overflow: document.body.style.overflow,
    paddingRight: document.body.style.paddingRight,
  };

  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  if (scrollbarWidth > 0) {
    document.documentElement.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }

  return () => {
    document.documentElement.style.overflow = htmlStyles.overflow;
    document.documentElement.style.paddingRight = htmlStyles.paddingRight;
    document.body.style.overflow = bodyStyles.overflow;
    document.body.style.paddingRight = bodyStyles.paddingRight;
    window.scrollTo(scrollX, scrollY);
  };
};

const unlockPreviewScroll = () => {
  unlockPreviewPageScroll?.();
  unlockPreviewPageScroll = undefined;
  document.documentElement.classList.remove("image-preview-open");
};

// Focus trap: keep Tab cycling within the preview dialog
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const installFocusTrap = () => {
  // Clean up any previously installed trap before installing a new one.
  // openPreview calls this on every open (e.g. switching images in a gallery),
  // so without this guard the keydown listener would accumulate.
  cleanupFocusTrap?.();
  cleanupFocusTrap = undefined;

  const root = previewElements?.root;
  if (!root) return;

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Tab" || !previewOpen) return;

    const focusable = Array.from(
      root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => el.offsetParent !== null);

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  root.addEventListener("keydown", handleKeydown);
  cleanupFocusTrap = () => {
    root.removeEventListener("keydown", handleKeydown);
  };
};

const getGalleryElements = () =>
  Array.from(document.querySelectorAll<HTMLElement>(galleryItemSelector));

const getGalleryData = (element: HTMLElement) => {
  const image = getElementImage(element);

  return {
    title:
      readText(element, ".photo-data-title") ||
      image?.alt?.trim() ||
      i18n("page.photos.photo", "Photo"),
    description: readText(element, ".photo-data-description"),
    detailUrl: readText(element, ".photo-detail-url"),
    fullUrl: readText(element, ".photo-full-url") || getImageSrc(element),
    groupName: readText(element, ".photo-group-name"),
    groupUrl: readText(element, ".photo-group-url"),
    date: readText(element, ".photo-data-date"),
    camera: readText(element, ".photo-data-camera"),
    tags: readAllText(element, ".photo-data-tag"),
    meta: readAllText(element, ".photo-meta-item"),
  };
};

const createGalleryItem = (element: HTMLElement): PreviewItem | null => {
  const src = getImageSrc(element);

  if (!src) {
    return null;
  }

  const data = getGalleryData(element);
  const image = getElementImage(element);

  return {
    src,
    thumb: getImageThumb(element, src),
    alt: image?.alt || data.title,
    title: data.title,
    description: data.description,
    detailUrl: data.detailUrl,
    fullUrl: data.fullUrl,
    groupName: data.groupName,
    groupUrl: data.groupUrl,
    date: data.date,
    camera: data.camera,
    tags: data.tags,
    meta: data.meta,
    element,
  };
};

const createContentItem = (image: HTMLImageElement): PreviewItem | null => {
  const src = getImageSrc(image);

  if (!src) {
    return null;
  }

  const title =
    image.alt?.trim() ||
    image.getAttribute("title")?.trim() ||
    i18n("page.photos.photo", "Photo");

  return {
    src,
    thumb: getImageThumb(image, src),
    alt: image.alt || title,
    title,
    description: "",
    detailUrl: "",
    fullUrl: src,
    groupName: "",
    groupUrl: "",
    date: "",
    camera: "",
    tags: [],
    meta: [],
    element: image,
  };
};

const createStandaloneItem = (element: HTMLElement): PreviewItem | null => {
  const src = getImageSrc(element);

  if (!src) {
    return null;
  }

  const image = getElementImage(element);
  const title =
    element.dataset.previewTitle ||
    element.getAttribute("aria-label")?.trim() ||
    element.getAttribute("title")?.trim() ||
    image?.alt?.trim() ||
    i18n("page.photos.photo", "Photo");

  return {
    src,
    thumb: getImageThumb(element, src),
    alt: element.dataset.previewAlt || image?.alt || title,
    title,
    description: "",
    detailUrl: "",
    fullUrl: src,
    groupName: "",
    groupUrl: "",
    date: "",
    camera: "",
    tags: [],
    meta: [],
    element,
  };
};

const collectGalleryItems = () =>
  getGalleryElements()
    .map(createGalleryItem)
    .filter((item): item is PreviewItem => Boolean(item));

const collectContentItems = (image: HTMLImageElement) => {
  const groupRoot =
    image.closest<HTMLElement>(".moment-media") ||
    image.closest<HTMLElement>(".markdown-body");
  const images = groupRoot
    ? Array.from(groupRoot.querySelectorAll<HTMLImageElement>("img"))
    : [image];

  return images
    .map(createContentItem)
    .filter((item): item is PreviewItem => Boolean(item));
};

const createIconButton = (
  icon: string,
  label: string,
  onClick: () => void,
  href?: string,
) => {
  const element = href
    ? document.createElement("a")
    : document.createElement("button");

  element.className = "earthquake-preview__action";
  element.setAttribute("aria-label", label);
  element.setAttribute("title", label);

  if (href && element instanceof HTMLAnchorElement) {
    element.href = href;
    element.target = "_blank";
    element.rel = "noopener noreferrer";
  } else if (element instanceof HTMLButtonElement) {
    element.type = "button";
  }

  // Build the icon span via createElement instead of innerHTML so a malformed
  // icon class string can never break out into HTML. The icon class comes
  // from internal constants (icon-[tabler--*] / icon-[simple-icons--*]) so
  // injection is not realistic today, but defense-in-depth keeps the surface
  // small if a future contributor wires up a user-controlled icon source.
  const iconSpan = document.createElement("span");
  iconSpan.className = icon;
  iconSpan.setAttribute("aria-hidden", "true");
  element.append(iconSpan);
  element.addEventListener("click", (event) => {
    if (!href) {
      event.preventDefault();
    }

    onClick();
  });

  return element;
};

const createMetaItem = (icon: string, value: string, href?: string) => {
  const element = href
    ? document.createElement("a")
    : document.createElement("span");

  element.className = "earthquake-preview__meta-item";

  // Build via createElement to avoid innerHTML; see createIconButton for
  // the same reasoning.
  const iconSpan = document.createElement("span");
  iconSpan.className = icon;
  iconSpan.setAttribute("aria-hidden", "true");
  const valueSpan = document.createElement("span");
  valueSpan.textContent = value;
  element.append(iconSpan, valueSpan);

  if (href && element instanceof HTMLAnchorElement) {
    element.href = href;
  }

  return element;
};

const renderActions = (item: PreviewItem) => {
  const elements = previewElements;

  if (!elements) {
    return;
  }

  elements.actions.textContent = "";

  const fullUrl = item.fullUrl || item.src;

  if (fullUrl) {
    elements.actions.append(
      createIconButton(
        "icon-[tabler--download]",
        i18n("page.photos.download", "Download"),
        () => undefined,
        fullUrl,
      ),
    );
  }

  if (navigator.share && fullUrl) {
    elements.actions.append(
      createIconButton(
        "icon-[tabler--share-3]",
        i18n("page.photos.share", "Share"),
        () => {
          void navigator.share({
            title: item.title,
            text: item.description,
            url: fullUrl,
          });
        },
      ),
    );
  }

  if (item.detailUrl) {
    elements.actions.append(
      createIconButton(
        "icon-[tabler--external-link]",
        i18n("page.photos.viewDetail", "Detail"),
        () => undefined,
        item.detailUrl,
      ),
    );
  }
};

const renderMeta = (item: PreviewItem) => {
  const elements = previewElements;

  if (!elements) {
    return;
  }

  elements.meta.textContent = "";

  const entries = [
    ...(item.date
      ? [{ icon: "icon-[tabler--calendar]", value: item.date }]
      : []),
    ...(item.camera
      ? [{ icon: "icon-[tabler--camera]", value: item.camera }]
      : []),
    ...(item.groupName
      ? [
          {
            icon: "icon-[tabler--folder]",
            value: item.groupName,
            href: item.groupUrl,
          },
        ]
      : []),
    ...item.tags.map((tag) => ({ icon: "icon-[tabler--tag]", value: tag })),
    ...item.meta.map((meta) => ({
      icon: "icon-[tabler--info-circle]",
      value: meta,
    })),
  ];

  entries.forEach((entry) => {
    elements.meta.append(createMetaItem(entry.icon, entry.value, entry.href));
  });

  elements.meta.hidden = entries.length === 0;
};

const renderRail = () => {
  const elements = previewElements;

  if (!elements) {
    return;
  }

  // Generate a cache key based on item sources to detect if items changed
  const cacheKey = previewItems.map((item) => item.src).join("|");

  if (cacheKey !== railCacheKey || railThumbButtons.length !== previewItems.length) {
    // Items changed: rebuild rail
    elements.rail.textContent = "";
    railThumbButtons = [];
    railCacheKey = cacheKey;

    if (previewItems.length <= 1) {
      elements.rail.hidden = true;
      return;
    }

    elements.rail.hidden = false;
    const fragment = document.createDocumentFragment();

    previewItems.forEach((item, index) => {
      const button = document.createElement("button");
      const image = document.createElement("img");

      button.type = "button";
      button.className = "earthquake-preview__thumb";
      button.dataset.previewIndex = String(index);
      button.setAttribute(
        "aria-label",
        `${i18n("page.photos.selectPhoto", "Select photo")} ${index + 1}`,
      );

      image.src = item.thumb || item.src;
      image.alt = "";
      image.loading = "lazy";
      button.append(image);
      button.addEventListener("click", () => {
        goToPreview(index);
      });

      railThumbButtons.push(button);
      fragment.append(button);
    });

    elements.rail.append(fragment);
  }

  // Update active state (lightweight, no DOM rebuild)
  railThumbButtons.forEach((button, index) => {
    const active = index === previewIndex;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "true" : "false");
  });

  // Scroll active thumb into view
  const activeThumb = railThumbButtons[previewIndex];
  if (activeThumb) {
    activeThumb.scrollIntoView({ block: "nearest", inline: "center" });
  }
};

const preloadImage = (src: string) => {
  if (!src) {
    return;
  }

  const image = new Image();
  image.decoding = "async";
  image.src = src;
  void image.decode?.().catch(() => undefined);
};

const preloadNearbyImages = () => {
  [previewIndex - 1, previewIndex + 1].forEach((index) => {
    const item = previewItems[index];

    if (item) {
      preloadImage(item.src);
    }
  });
};

const renderPreview = () => {
  const elements = previewElements;
  const item = previewItems[previewIndex];

  if (!elements || !item) {
    return;
  }

  elements.root.style.setProperty(
    "--earthquake-preview-image",
    `url("${escapeCssUrl(item.thumb || item.src)}")`,
  );
  elements.root.classList.toggle("is-gallery", previewMode === "gallery");
  elements.root.classList.add("is-loading");
  elements.image.src = item.src;
  elements.image.alt = item.alt;

  if (elements.image.complete && elements.image.naturalWidth > 0) {
    imageLoadAbort?.abort();
    imageLoadAbort = null;
    elements.root.classList.remove("is-loading");
  } else {
    // Abort any previously registered load/error listener pair so they don't
    // accumulate across rapid image switches.
    imageLoadAbort?.abort();
    imageLoadAbort = new AbortController();
    const { signal } = imageLoadAbort;
    const onLoaded = () => {
      elements.root.classList.remove("is-loading");
      imageLoadAbort?.abort();
      imageLoadAbort = null;
    };
    elements.image.addEventListener("load", onLoaded, { signal });
    elements.image.addEventListener("error", onLoaded, { signal });
  }

  elements.title.textContent = item.title;
  elements.description.textContent = item.description;
  elements.description.hidden = !item.description;
  elements.counter.textContent = `${previewIndex + 1} / ${previewItems.length}`;
  elements.previousButton.disabled = previewIndex === 0;
  elements.nextButton.disabled = previewIndex === previewItems.length - 1;
  elements.previousButton.hidden = previewItems.length <= 1;
  elements.nextButton.hidden = previewItems.length <= 1;

  renderMeta(item);
  renderActions(item);
  renderRail();
  preloadNearbyImages();
};

const goToPreview = (index: number) => {
  if (index < 0 || index >= previewItems.length || index === previewIndex) {
    return;
  }

  previewIndex = index;
  renderPreview();
};

const goBy = (offset: number) => {
  goToPreview(previewIndex + offset);
};

const closePreview = () => {
  const elements = previewElements;

  if (!elements || !previewOpen) {
    return;
  }

  previewOpen = false;
  pointerStart = null;
  elements.root.classList.remove("is-open");
  unlockPreviewScroll();

  // Abort any pending image load listener so it can't fire after close.
  imageLoadAbort?.abort();
  imageLoadAbort = null;

  // Clean up focus trap
  cleanupFocusTrap?.();
  cleanupFocusTrap = undefined;

  // Restore focus to the trigger element.
  // Guard against the trigger having been removed from the DOM (e.g. by SPA
  // navigation between open and close) — focusing a detached node throws in
  // some browsers and otherwise silently no-ops; either way we don't want it.
  if (triggerElement) {
    if (triggerElement.isConnected) {
      triggerElement.focus({ preventScroll: true });
    }
    triggerElement = null;
  }

  // Reset rail cache so it rebuilds next time
  railCacheKey = "";
  railThumbButtons = [];

  if (closeTimer) {
    window.clearTimeout(closeTimer);
  }

  closeTimer = window.setTimeout(() => {
    if (!previewOpen) {
      elements.root.hidden = true;
    }
  }, 180);
};

const openPreview = (
  items: PreviewItem[],
  index: number,
  mode: PreviewMode,
  trigger?: HTMLElement | null,
) => {
  const elements = ensurePreviewElements();

  if (items.length === 0 || index < 0) {
    return;
  }

  // Clamp index into a valid range. items.length is already > 0 here, so
  // Math.min never underflows; we still cap the lower bound defensively in
  // case a future caller passes a negative index that survived the check
  // above (e.g. via negation overflow on 32-bit platforms).
  const safeIndex = Math.max(0, Math.min(index, items.length - 1));

  if (closeTimer) {
    window.clearTimeout(closeTimer);
    closeTimer = undefined;
  }

  previewItems = items;
  previewIndex = safeIndex;
  previewMode = mode;
  previewOpen = true;
  triggerElement = trigger ?? null;
  elements.root.hidden = false;
  unlockPreviewScroll();
  unlockPreviewPageScroll = lockPageScroll();
  document.documentElement.classList.add("image-preview-open");
  renderPreview();

  window.requestAnimationFrame(() => {
    elements.root.classList.add("is-open");
    elements.closeButton.focus({ preventScroll: true });
    installFocusTrap();
  });
};

const handleDocumentClick = (event: MouseEvent) => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  const target = event.target;

  if (!(target instanceof Element) || target.closest(".earthquake-preview")) {
    return;
  }

  const galleryElement = target.closest<HTMLElement>(galleryItemSelector);

  if (galleryElement) {
    const items = collectGalleryItems();
    const index = items.findIndex((item) => item.element === galleryElement);

    event.preventDefault();
    event.stopImmediatePropagation();
    openPreview(items, index, "gallery", galleryElement);
    return;
  }

  const previewElement = target.closest<HTMLElement>("[data-preview-src]");

  if (previewElement) {
    const item = createStandaloneItem(previewElement);

    if (!item) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    openPreview([item], 0, "content", previewElement);
    return;
  }

  const image = target.closest<HTMLImageElement>(previewableImageSelector);

  if (!image) {
    return;
  }

  const items = collectContentItems(image);
  const index = items.findIndex((item) => item.element === image);

  event.preventDefault();
  event.stopImmediatePropagation();
  openPreview(items, index, "content", image as HTMLElement);
};

const handleKeydown = (event: KeyboardEvent) => {
  if (!previewOpen) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closePreview();
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    goBy(-1);
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    goBy(1);
  }
};

const handlePointerDown = (event: PointerEvent) => {
  if (!event.isPrimary) {
    return;
  }

  pointerStart = {
    x: event.clientX,
    y: event.clientY,
  };
};

const handlePointerUp = (event: PointerEvent) => {
  if (!pointerStart || !event.isPrimary) {
    pointerStart = null;
    return;
  }

  const deltaX = event.clientX - pointerStart.x;
  const deltaY = event.clientY - pointerStart.y;
  pointerStart = null;

  if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) {
    return;
  }

  if (deltaX < 0) {
    goBy(1);
    return;
  }

  goBy(-1);
};

const ensurePreviewElements = () => {
  if (previewElements && document.body.contains(previewElements.root)) {
    return previewElements;
  }

  const root = document.createElement("div");
  root.className = "earthquake-preview";
  root.hidden = true;
  root.tabIndex = -1;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", i18n("page.photos.preview", "Image preview"));

  // Build DOM using createElement instead of innerHTML for better security
  const backdrop = document.createElement("div");
  backdrop.className = "earthquake-preview__backdrop";
  backdrop.dataset.previewClose = "";

  const viewport = document.createElement("div");
  viewport.className = "earthquake-preview__viewport";
  viewport.dataset.previewViewport = "";

  const counter = document.createElement("div");
  counter.className = "earthquake-preview__counter";
  counter.dataset.previewCounter = "";

  const closeButton = document.createElement("button");
  closeButton.className = "earthquake-preview__close";
  closeButton.type = "button";
  closeButton.dataset.previewClose = "";
  closeButton.setAttribute("aria-label", i18n("common.close", "Close"));
  const closeIcon = document.createElement("span");
  closeIcon.className = "icon-[tabler--x]";
  closeIcon.setAttribute("aria-hidden", "true");
  closeButton.append(closeIcon);

  const prevButton = document.createElement("button");
  prevButton.className = "earthquake-preview__nav earthquake-preview__nav--previous";
  prevButton.type = "button";
  prevButton.dataset.previewPrevious = "";
  prevButton.setAttribute("aria-label", i18n("pagination.previous", "Previous"));
  const prevIcon = document.createElement("span");
  prevIcon.className = "icon-[tabler--chevron-left]";
  prevIcon.setAttribute("aria-hidden", "true");
  prevButton.append(prevIcon);

  const nextButton = document.createElement("button");
  nextButton.className = "earthquake-preview__nav earthquake-preview__nav--next";
  nextButton.type = "button";
  nextButton.dataset.previewNext = "";
  nextButton.setAttribute("aria-label", i18n("pagination.next", "Next"));
  const nextIcon = document.createElement("span");
  nextIcon.className = "icon-[tabler--chevron-right]";
  nextIcon.setAttribute("aria-hidden", "true");
  nextButton.append(nextIcon);

  const stage = document.createElement("div");
  stage.className = "earthquake-preview__stage";
  stage.dataset.previewStage = "";

  const image = document.createElement("img");
  image.className = "earthquake-preview__image";
  image.dataset.previewImage = "";
  image.alt = "";

  stage.append(image);

  const info = document.createElement("aside");
  info.className = "earthquake-preview__info";
  info.dataset.previewInfo = "";

  const title = document.createElement("h2");
  title.className = "earthquake-preview__title";
  title.dataset.previewTitle = "";

  const description = document.createElement("p");
  description.className = "earthquake-preview__description";
  description.dataset.previewDescription = "";

  const meta = document.createElement("div");
  meta.className = "earthquake-preview__meta";
  meta.dataset.previewMeta = "";

  const actions = document.createElement("div");
  actions.className = "earthquake-preview__actions";
  actions.dataset.previewActions = "";

  info.append(title, description, meta, actions);

  const rail = document.createElement("div");
  rail.className = "earthquake-preview__rail";
  rail.dataset.previewRail = "";

  viewport.append(counter, closeButton, prevButton, nextButton, stage, info, rail);
  root.append(backdrop, viewport);
  document.body.append(root);

  previewElements = {
    root,
    viewport,
    stage,
    image,
    title,
    description,
    meta,
    actions,
    rail,
    counter,
    previousButton: prevButton,
    nextButton,
    closeButton,
  };

  root
    .querySelectorAll<HTMLElement>("[data-preview-close]")
    .forEach((close) => {
      close.addEventListener("click", closePreview);
    });
  prevButton.addEventListener("click", () => {
    goBy(-1);
  });
  nextButton.addEventListener("click", () => {
    goBy(1);
  });
  stage.addEventListener("pointerdown", handlePointerDown);
  stage.addEventListener("pointerup", handlePointerUp);
  stage.addEventListener("pointercancel", () => {
    pointerStart = null;
  });

  return previewElements;
};

export const initImagePreview = () => {
  destroyImagePreview();
  ensurePreviewElements();

  document.addEventListener("click", handleDocumentClick, true);
  document.addEventListener("keydown", handleKeydown);

  cleanupDocumentClick = () => {
    document.removeEventListener("click", handleDocumentClick, true);
  };
  cleanupKeyboard = () => {
    document.removeEventListener("keydown", handleKeydown);
  };
};

const destroyImagePreview = () => {
  cleanupDocumentClick?.();
  cleanupKeyboard?.();
  cleanupDocumentClick = undefined;
  cleanupKeyboard = undefined;
  cleanupFocusTrap?.();
  cleanupFocusTrap = undefined;
  closePreview();
  // Clear any pending close timer so its callback can't touch the root after
  // it has been removed below.
  if (closeTimer) {
    window.clearTimeout(closeTimer);
    closeTimer = undefined;
  }
  // Abort any pending image load listener.
  imageLoadAbort?.abort();
  imageLoadAbort = null;
  previewElements?.root.remove();
  previewElements = null;
  previewItems = [];
  previewIndex = 0;
  previewMode = "content";
  previewOpen = false;
  pointerStart = null;
  triggerElement = null;
  railCacheKey = "";
  railThumbButtons = [];
  unlockPreviewScroll();
};
