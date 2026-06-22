type TocHeading = {
  id: string;
  level: number;
  label: string;
  element: HTMLHeadingElement;
  children: TocHeading[];
};

const headingSelector = "h1, h2, h3, h4";
let cleanupToc: (() => void) | undefined;

const slugify = (value: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, "");

  return slug || "section";
};

const ensureHeadingIds = (headings: HTMLHeadingElement[]) => {
  const usedIds = new Set<string>(
    Array.from(document.querySelectorAll<HTMLElement>("[id]")).map(
      (element) => element.id,
    ),
  );

  headings.forEach((heading, index) => {
    if (heading.id) {
      return;
    }

    const baseId = slugify(heading.textContent || `section-${index + 1}`);
    let id = baseId;
    let suffix = 2;

    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }

    heading.id = id;
    usedIds.add(id);
  });
};

const buildTocTree = (headings: HTMLHeadingElement[]) => {
  const root: TocHeading = {
    id: "",
    level: 0,
    label: "",
    element: headings[0],
    children: [],
  };
  const stack = [root];

  headings.forEach((heading) => {
    const level = Number(heading.tagName.slice(1));
    const label = heading.textContent?.replace(/\s+/g, " ").trim() || "";

    if (!label) {
      return;
    }

    const node: TocHeading = {
      id: heading.id,
      level,
      label,
      element: heading,
      children: [],
    };

    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    stack[stack.length - 1].children.push(node);
    stack.push(node);
  });

  return root.children;
};

const renderTocList = (nodes: TocHeading[]) => {
  const list = document.createElement("ul");
  list.className = "toc-list space-y-1 dark:border-slate-500";

  nodes.forEach((node) => {
    const item = document.createElement("li");
    const link = document.createElement("a");

    item.className = "toc-list-item";
    link.className =
      "toc-link group flex items-center justify-between rounded px-1.5 py-1 text-sm opacity-80 transition-all hover:bg-gray-100 dark:text-slate-50 dark:hover:bg-slate-700";
    link.href = `#${node.id}`;
    link.textContent = node.label;
    link.title = node.label;

    link.addEventListener("click", (event) => {
      event.preventDefault();
      node.element.scrollIntoView({ block: "start", behavior: "smooth" });
      history.pushState(null, "", `#${node.id}`);
      setActiveHeading(node.id);
    });

    item.append(link);

    if (node.children.length > 0) {
      item.append(renderTocList(node.children));
    }

    list.append(item);
  });

  return list;
};

const setActiveHeading = (id: string) => {
  document.querySelectorAll<HTMLAnchorElement>(".toc-link").forEach((link) => {
    const active = link.hash === `#${id}`;
    link.classList.toggle("is-active-link", active);
    link.setAttribute("aria-current", active ? "true" : "false");

    if (active) {
      link.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });
};

const createActiveHeadingUpdater = (headings: HTMLHeadingElement[]) => {
  let updateScheduled = false;

  const update = () => {
    updateScheduled = false;

    const activeHeading =
      headings.findLast(
        (heading) => heading.getBoundingClientRect().top <= 120,
      ) ?? headings[0];

    if (activeHeading) {
      setActiveHeading(activeHeading.id);
    }
  };

  const scheduleUpdate = () => {
    if (updateScheduled) {
      return;
    }

    updateScheduled = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate, { passive: true });
  scheduleUpdate();

  return () => {
    window.removeEventListener("scroll", scheduleUpdate);
    window.removeEventListener("resize", scheduleUpdate);
  };
};

const destroyToc = () => {
  cleanupToc?.();
  cleanupToc = undefined;
};

export function generateToc(
  contentId: string,
  tocSelector: string,
  tocContainerSelector: string,
) {
  destroyToc();

  const content = document.getElementById(contentId);
  const tocContainers = Array.from(
    document.querySelectorAll<HTMLElement>(tocContainerSelector),
  );
  const tocTargets = Array.from(
    document.querySelectorAll<HTMLElement>(tocSelector),
  );
  const headings = Array.from(
    content?.querySelectorAll<HTMLHeadingElement>(headingSelector) ?? [],
  ).filter((heading) => heading.offsetParent !== null);

  if (
    !content ||
    tocTargets.length === 0 ||
    tocContainers.length === 0 ||
    headings.length === 0
  ) {
    tocContainers.forEach((container) => container.remove());
    return;
  }

  ensureHeadingIds(headings);
  const tocTree = buildTocTree(headings);

  if (tocTree.length === 0) {
    tocContainers.forEach((container) => container.remove());
    return;
  }

  tocTargets.forEach((target) => {
    target.replaceChildren(renderTocList(tocTree));
  });

  cleanupToc = createActiveHeadingUpdater(headings);
}
