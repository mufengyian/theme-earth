export const i18n = (key: string, fallback: string): string =>
  (window as Record<string, any>).i18nResources?.[key] || fallback;
