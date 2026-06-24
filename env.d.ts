/// <reference types="astro/client" />
import type { Alpine } from "alpinejs";

export {};

declare global {
  namespace astroHTML.JSX {
    type TemplateAttributeValue = string | boolean | null | undefined;

    interface HTMLAttributes {
      "sec:authorize"?: TemplateAttributeValue;
      "th:alt"?: TemplateAttributeValue;
      "th:aria-label"?: TemplateAttributeValue;
      "th:attr"?: TemplateAttributeValue;
      "th:classappend"?: TemplateAttributeValue;
      "th:each"?: TemplateAttributeValue;
      "th:fragment"?: TemplateAttributeValue;
      "th:href"?: TemplateAttributeValue;
      "th:if"?: TemplateAttributeValue;
      "th:inline"?: TemplateAttributeValue;
      "th:lang"?: TemplateAttributeValue;
      "th:replace"?: TemplateAttributeValue;
      "th:rel"?: TemplateAttributeValue;
      "th:src"?: TemplateAttributeValue;
      "th:srcset"?: TemplateAttributeValue;
      "th:style"?: TemplateAttributeValue;
      "th:styleappend"?: TemplateAttributeValue;
      "th:target"?: TemplateAttributeValue;
      "th:text"?: TemplateAttributeValue;
      "th:title"?: TemplateAttributeValue;
      "th:unless"?: TemplateAttributeValue;
      "th:utext"?: TemplateAttributeValue;
      "th:with"?: TemplateAttributeValue;
      [name: `@${string}`]: TemplateAttributeValue;
      [name: `x-${string}`]: TemplateAttributeValue;
    }

    interface HaloCommentAttributes extends HTMLAttributes {
      group?: TemplateAttributeValue;
      kind?: TemplateAttributeValue;
    }

    interface IntrinsicElements {
      "halo:comment": HaloCommentAttributes;
      "halo:footer": HTMLAttributes;
      "th:block": HTMLAttributes;
    }
  }

  interface Window {
    Alpine: Alpine;
    SearchWidget: any;
    i18nResources: Record<string, string>;
    colorScheme: "dark" | "light" | "system";
    enableChangeColorScheme: boolean;
    enableColorSchemeAnimation: boolean;
  }
}
