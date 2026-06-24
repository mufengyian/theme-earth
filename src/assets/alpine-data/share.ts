const themeBaseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

type ShareItem = {
  id: string;
  name: string;
  icon: string;
  type: "url" | "native";
  url?: string;
};

type ShareState = {
  permalink: string;
  title: string;
  shareModal: boolean;
  copied: boolean;
  copyTimer: number | undefined;
  presetShareItems: ShareItem[];
  readonly activeShareItems: ShareItem[];
  handleShare(id: string): Promise<void>;
  handleCopy(): Promise<void>;
};

const shareUrl = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) =>
    encodeURIComponent(values[key] ?? ""),
  );

const isShareItem = (item?: ShareItem): item is ShareItem => Boolean(item);

const normalizeShareIds = (shareIds: string | string[]): string[] => {
  if (Array.isArray(shareIds)) {
    return shareIds;
  }

  if (typeof shareIds === "string" && shareIds.length > 0) {
    return shareIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }

  return [];
};

export default (shareIds: string | string[]) =>
  ({
    permalink: window.location.href,
    title: document.title,
    shareModal: false,
    copied: false,
    copyTimer: undefined,
    presetShareItems: [
      {
        id: "x",
        name: "X",
        icon: "icon-[simple-icons--x]",
        type: "url",
        url: `https://x.com/share?url={url}&text={title}`,
      },
      {
        id: "telegram",
        name: "Telegram",
        icon: "icon-[simple-icons--telegram]",
        type: "url",
        url: `https://telegram.me/share/url?url={url}&text={title}`,
      },
      {
        id: "facebook",
        name: "Facebook",
        icon: "icon-[simple-icons--facebook]",
        type: "url",
        url: `https://facebook.com/sharer/sharer.php?u={url}`,
      },
      {
        id: "qq",
        name: "QQ",
        icon: "icon-[simple-icons--tencentqq]",
        type: "url",
        url: `https://connect.qq.com/widget/shareqq/iframe_index.html?url={url}&title={title}`,
      },
      {
        id: "qzone",
        name: window.i18nResources["jsModule.share.qzone"],
        icon: "icon-[simple-icons--qzone]",
        type: "url",
        url: `https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url={url}&title={title}`,
      },
      {
        id: "weibo",
        name: window.i18nResources["jsModule.share.weibo"],
        icon: "icon-[simple-icons--sinaweibo]",
        type: "url",
        url: `https://service.weibo.com/share/share.php?url={url}&title={title}`,
      },
      {
        id: "douban",
        name: window.i18nResources["jsModule.share.douban"],
        icon: "icon-[simple-icons--douban]",
        type: "url",
        url: `https://www.douban.com/share/service?href={url}&name={title}`,
      },
      {
        id: "wechat",
        name: window.i18nResources["jsModule.share.wechat"],
        icon: "icon-[simple-icons--wechat]",
        type: "url",
        url: `${themeBaseUrl}/assets/qrcode-share.html?url={url}`,
      },
      {
        id: "native",
        name: window.i18nResources["jsModule.share.native"],
        icon: "icon-[tabler--device-desktop]",
        type: "native",
      },
    ],
    get activeShareItems() {
      return normalizeShareIds(shareIds)
        .map((id) => this.presetShareItems.find((item) => item.id === id))
        .filter(isShareItem)
        .filter(
          (item) =>
            item?.type !== "native" ||
            navigator.canShare?.({ title: this.title, url: this.permalink }),
        );
    },
    async handleShare(id: string) {
      const shareItem = this.activeShareItems.find((item) => item?.id === id);

      if (!shareItem) {
        return;
      }

      if (shareItem.type === "native") {
        if (navigator.share) {
          await navigator.share({
            title: this.title,
            url: this.permalink,
          });
          return;
        }
        return;
      }

      const width = 1000;
      const height = 500;
      const top = window.innerHeight / 2 - height / 2;
      const left = window.innerWidth / 2 - width / 2;
      const windowParams = `width=${width},height=${height},top=${top},left=${left},status=no,scrollbars=no,resizable=no`;
      window.open(
        shareUrl(shareItem.url || "", {
          url: this.permalink,
          title: this.title,
        }),
        `${window.i18nResources["jsModule.share.windowTitle"]} - ${this.title}`,
        windowParams,
      );
    },
    async handleCopy() {
      try {
        await navigator.clipboard.writeText(this.permalink);
      } catch {
        // Clipboard API may be unavailable (insecure context) or denied by
        // the user. Silently no-op so the UI never shows a stuck "copied".
        return;
      }
      this.copied = true;
      if (this.copyTimer) {
        window.clearTimeout(this.copyTimer);
      }
      this.copyTimer = window.setTimeout(() => {
        this.copied = false;
      }, 2000);
    },
  }) satisfies ShareState;
