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

  element.innerHTML = `<span class="${icon}" aria-hidden="true"></span>`;
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
  element.innerHTML = `<span class="${icon}" aria-hidden="true"></span><span></span>`;
  element.querySelector("span:last-child")!.textContent = value;

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

  elements.rail.textContent = "";
  elements.rail.hidden = previewItems.length <= 1;

  if (previewItems.length <= 1) {
    return;
  }

  const fragment = document.createDocumentFragment();

  previewItems.forEach((item, index) => {
    const button = document.createElement("button");
    const image = document.createElement("img");
    const active = index === previewIndex;

    button.type = "button";
    button.className = "earthquake-preview__thumb";
    button.dataset.previewIndex = String(index);
    button.setAttribute(
      "aria-label",
      `${i18n("page.photos.selectPhoto", "Select photo")} ${index + 1}`,
    );
    button.setAttribute("aria-current", active ? "true" : "false");
    button.classList.toggle("is-active", active);

    image.src = item.thumb || item.src;
    image.alt = "";
    image.loading = "lazy";
    button.append(image);
    button.addEventListener("click", () => {
      goToPreview(index);
    });

    fragment.append(button);
  });

  elements.rail.append(fragment);
  elements.rail
    .querySelector<HTMLElement>(".earthquake-preview__thumb.is-active")
    ?.scrollIntoView({ block: "nearest", inline: "center" });
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
    elements.root.classList.remove("is-loading");
  } else {
    const onLoaded = () => {
      elements.root.classList.remove("is-loading");
      elements.image.removeEventListener("load", onLoaded);
      elements.image.removeEventListener("error", onLoaded);
    };
    elements.image.addEventListener("load", onLoaded);
    elements.image.addEventListener("error", onLoaded);
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
) => {
  const elements = ensurePreviewElements();

  if (items.length === 0 || index < 0) {
    return;
  }

  if (closeTimer) {
    window.clearTimeout(closeTimer);
    closeTimer = undefined;
  }

  previewItems = items;
  previewIndex = Math.min(index, items.length - 1);
  previewMode = mode;
  previewOpen = true;
  elements.root.hidden = false;
  unlockPreviewScroll();
  unlockPreviewPageScroll = lockPageScroll();
  document.documentElement.classList.add("image-preview-open");
  renderPreview();

  window.requestAnimationFrame(() => {
    elements.root.classList.add("is-open");
    elements.closeButton.focus({ preventScroll: true });
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
    openPreview(items, index, "gallery");
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
    openPreview([item], 0, "content");
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
  openPreview(items, index, "content");
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
  root.innerHTML = `
    <div class="earthquake-preview__backdrop" data-preview-close></div>
    <div class="earthquake-preview__viewport" data-preview-viewport>
      <div class="earthquake-preview__counter" data-preview-counter></div>
      <button class="earthquake-preview__close" type="button" data-preview-close aria-label="${i18n("common.close", "Close")}">
        <span class="icon-[tabler--x]" aria-hidden="true"></span>
      </button>
      <button class="earthquake-preview__nav earthquake-preview__nav--previous" type="button" data-preview-previous aria-label="${i18n("pagination.previous", "Previous")}">
        <span class="icon-[tabler--chevron-left]" aria-hidden="true"></span>
      </button>
      <button class="earthquake-preview__nav earthquake-preview__nav--next" type="button" data-preview-next aria-label="${i18n("pagination.next", "Next")}">
        <span class="icon-[tabler--chevron-right]" aria-hidden="true"></span>
      </button>
      <div class="earthquake-preview__stage" data-preview-stage>
        <img class="earthquake-preview__image" data-preview-image alt="" />
      </div>
      <aside class="earthquake-preview__info" data-preview-info>
        <h2 class="earthquake-preview__title" data-preview-title></h2>
        <p class="earthquake-preview__description" data-preview-description></p>
        <div class="earthquake-preview__meta" data-preview-meta></div>
        <div class="earthquake-preview__actions" data-preview-actions></div>
      </aside>
      <div class="earthquake-preview__rail" data-preview-rail></div>
    </div>
  `;

  document.body.append(root);

  previewElements = {
    root,
    viewport: queryRequired<HTMLDivElement>(root, "[data-preview-viewport]"),
    stage: queryRequired<HTMLDivElement>(root, "[data-preview-stage]"),
    image: queryRequired<HTMLImageElement>(root, "[data-preview-image]"),
    title: queryRequired<HTMLHeadingElement>(root, "[data-preview-title]"),
    description: queryRequired<HTMLParagraphElement>(
      root,
      "[data-preview-description]",
    ),
    meta: queryRequired<HTMLDivElement>(root, "[data-preview-meta]"),
    actions: queryRequired<HTMLDivElement>(root, "[data-preview-actions]"),
    rail: queryRequired<HTMLDivElement>(root, "[data-preview-rail]"),
    counter: queryRequired<HTMLDivElement>(root, "[data-preview-counter]"),
    previousButton: queryRequired<HTMLButtonElement>(
      root,
      "[data-preview-previous]",
    ),
    nextButton: queryRequired<HTMLButtonElement>(root, "[data-preview-next]"),
    closeButton: queryRequired<HTMLButtonElement>(
      root,
      ".earthquake-preview__close",
    ),
  };

  root
    .querySelectorAll<HTMLElement>("[data-preview-close]")
    .forEach((close) => {
      close.addEventListener("click", closePreview);
    });
  previewElements.previousButton.addEventListener("click", () => {
    goBy(-1);
  });
  previewElements.nextButton.addEventListener("click", () => {
    goBy(1);
  });
  previewElements.stage.addEventListener("pointerdown", handlePointerDown);
  previewElements.stage.addEventListener("pointerup", handlePointerUp);
  previewElements.stage.addEventListener("pointercancel", () => {
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
  closePreview();
  previewElements?.root.remove();
  previewElements = null;
  previewItems = [];
  previewIndex = 0;
  previewMode = "content";
  previewOpen = false;
  pointerStart = null;
  unlockPreviewScroll();
};
