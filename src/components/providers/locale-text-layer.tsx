"use client";

import { useEffect } from "react";
import { clientTextTranslations, type Locale } from "@/lib/i18n";

const skippedTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH"]);
const translatedAttributes = ["placeholder", "aria-label", "title"];

function replacePreservingWhitespace(value: string, translations: Record<string, string>) {
  const trimmed = value.trim();
  const translated = translations[trimmed];
  if (!translated) return value;

  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

function shouldSkipElement(element: Element) {
  return skippedTags.has(element.tagName) || element.closest("[data-no-translate]") !== null;
}

function translateRoot(root: ParentNode, translations: Record<string, string>) {
  if (root instanceof Element && shouldSkipElement(root)) return;

  if (root instanceof Element) {
    for (const attribute of translatedAttributes) {
      const value = root.getAttribute(attribute);
      if (value) root.setAttribute(attribute, replacePreservingWhitespace(value, translations));
    }
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
    node.nodeValue = replacePreservingWhitespace(node.nodeValue ?? "", translations);
  }
}

export function LocaleTextLayer({ locale }: { locale: Locale }) {
  useEffect(() => {
    const translations = clientTextTranslations(locale);
    translateRoot(document.body, translations);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
              translateRoot(node as ParentNode, translations);
            }
          });
        }

        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          translateRoot(mutation.target, translations);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: translatedAttributes
    });

    return () => observer.disconnect();
  }, [locale]);

  return null;
}
