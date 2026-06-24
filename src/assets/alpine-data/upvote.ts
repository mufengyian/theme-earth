interface UpvoteState {
  upvotedNames: string[];
  init(): void;
  upvoted(id?: string): boolean;
  handleUpvote(name?: string): void;
}

const resolveName = (state: UpvoteState, key: string, name?: string): string | undefined => {
  if (name !== undefined && name !== "") {
    return name;
  }

  const $el = (state as Record<string, unknown>).$el as HTMLElement | undefined;
  if (!$el) {
    return undefined;
  }

  return (
    $el.dataset[`upvote${key.charAt(0).toUpperCase() + key.slice(1)}Name`] ||
    $el.dataset[`${key}Name`]
  );
};

export default (key: string, group: string, plural: string): UpvoteState => ({
  upvotedNames: [],
  init() {
    try {
      const storedNames = JSON.parse(
        localStorage.getItem(`halo.upvoted.${key}.names`) || "[]",
      );

      this.upvotedNames = Array.isArray(storedNames) ? storedNames : [];
    } catch {
      this.upvotedNames = [];
    }
  },
  upvoted(id?: string) {
    const target = resolveName(this, key, id);
    if (!target) {
      return false;
    }
    return this.upvotedNames.includes(target);
  },
  async handleUpvote(name?: string) {
    const target = resolveName(this, key, name);
    if (!target) {
      return;
    }

    if (this.upvoted(target)) {
      return;
    }

    const response = await fetch(
      "/apis/api.halo.run/v1alpha1/trackers/upvote",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          group,
          plural,
          name: target,
        }),
      },
    ).catch(() => undefined);

    if (!response?.ok) {
      alert(window.i18nResources["jsModule.upvote.networkError"]);
      return;
    }

    this.upvotedNames = [...this.upvotedNames, target];

    try {
      localStorage.setItem(
        `halo.upvoted.${key}.names`,
        JSON.stringify(this.upvotedNames),
      );
    } catch {
      // Ignore storage failures so the visible count can still update.
    }

    const upvoteNode = Array.from(
      document.querySelectorAll<HTMLElement>(`[data-upvote-${key}-name]`),
    ).find((node) => node.getAttribute(`data-upvote-${key}-name`) === target);

    if (!upvoteNode) {
      return;
    }

    const upvoteCount = Number.parseInt(upvoteNode.textContent || "0", 10);
    upvoteNode.textContent = String(
      (Number.isNaN(upvoteCount) ? 0 : upvoteCount) + 1,
    );
  },
});
