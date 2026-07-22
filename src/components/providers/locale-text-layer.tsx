"use client";

import { useEffect } from "react";
import { translateText, type Locale } from "@/lib/i18n";

const skippedTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH"]);
const translatedAttributes = ["placeholder", "aria-label", "title"];
const skippedSelectors = [
  "[data-no-translate]",
  "nextjs-portal",
  "[data-nextjs-dialog-overlay]",
  "[data-nextjs-toast]",
  "[data-nextjs-portal]"
].join(",");

function applyTranslatedText(node: Text, value: string) {
  if (node.nodeValue !== value) {
    node.nodeValue = value;
  }
}

function applyTranslatedAttribute(element: Element, attribute: string, value: string) {
  const currentValue = element.getAttribute(attribute);
  if (currentValue !== value) {
    element.setAttribute(attribute, value);
  }
}

function replacePreservingWhitespace(value: string, locale: Locale) {
  const trimmed = value.trim();
  const translated = translateText(trimmed, locale);
  if (translated === trimmed) return value;

  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

function shouldSkipElement(element: Element) {
  return skippedTags.has(element.tagName) || element.closest(skippedSelectors) !== null;
}

function translateElementAttributes(element: Element, locale: Locale) {
  for (const attribute of translatedAttributes) {
    const value = element.getAttribute(attribute);
    if (value) applyTranslatedAttribute(element, attribute, replacePreservingWhitespace(value, locale));
  }
}

function translateRoot(root: Node, locale: Locale) {
  if (root instanceof Element && shouldSkipElement(root)) return;

  if (root instanceof Element) {
    translateElementAttributes(root, locale);

    // Alt elemanların attribute'ları yalnızca mutation anında değil,
    // tam taramada da çevrilmeli; yoksa dil değişiminde eski dilde kalıyorlar.
    for (const element of Array.from(root.querySelectorAll("[placeholder], [aria-label], [title]"))) {
      if (!shouldSkipElement(element)) translateElementAttributes(element, locale);
    }
  }

  if (root.nodeType === Node.TEXT_NODE) {
    applyTranslatedText(root as Text, replacePreservingWhitespace(root.nodeValue ?? "", locale));
    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }

  for (const node of nodes) {
    applyTranslatedText(node, replacePreservingWhitespace(node.nodeValue ?? "", locale));
  }
}

let hasCompletedInitialPass = false;

export function LocaleTextLayer({ locale }: { locale: Locale }) {
  useEffect(() => {
    let observer: MutationObserver | null = null;
    let cancelled = false;
    let idleHandle: number | null = null;

    function startTranslationLayer() {
      if (cancelled) return;

      hasCompletedInitialPass = true;
      translateRoot(document.body, locale);

      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "childList") {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
                translateRoot(node, locale);
              }
            });
          }

          if (mutation.type === "attributes" && mutation.target instanceof Element) {
            translateRoot(mutation.target, locale);
          }

          if (mutation.type === "characterData") {
            translateRoot(mutation.target, locale);
          }
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: translatedAttributes
      });
    }

    // 1200ms bekleme yalnızca ilk hydration'ı korumak için gerekli;
    // dil değişiminde beklemek eski dildeki metinlerin ekranda kalmasına yol açıyor.
    const startDelayMs = hasCompletedInitialPass ? 80 : 1200;

    const timeout = window.setTimeout(() => {
      const idleWindow = window as Window & {
        requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      };

      if (idleWindow.requestIdleCallback && !hasCompletedInitialPass) {
        idleHandle = idleWindow.requestIdleCallback(startTranslationLayer, { timeout: 1000 });
      } else {
        startTranslationLayer();
      }
    }, startDelayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);

      if (idleHandle !== null) {
        const idleWindow = window as Window & {
          cancelIdleCallback?: (handle: number) => void;
        };

        if (idleWindow.cancelIdleCallback) {
          idleWindow.cancelIdleCallback(idleHandle);
        }
      }

      observer?.disconnect();
    };
  }, [locale]);

  return null;
}
