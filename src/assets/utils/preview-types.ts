export type PreviewMode = "content" | "gallery";

export type PreviewItem = {
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

export type PreviewElements = {
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

export type PointerStart = {
  x: number;
  y: number;
};
