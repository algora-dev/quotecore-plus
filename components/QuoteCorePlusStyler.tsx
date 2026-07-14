"use client";

import { useEffect } from "react";

const SKIP_SELECTOR = [
  "script",
  "style",
  "noscript",
  "textarea",
  "input",
  "select",
  "option",
  ".brand-wordmark",
  "[data-quotecore-styled]",
].join(",");

function styleQuoteCoreTextNode(node: Text) {
  const text = node.nodeValue;
  const parent = node.parentElement;

  if (!text?.includes("QuoteCore+") || !parent || parent.closest(SKIP_SELECTOR)) {
    return;
  }

  const fragment = document.createDocumentFragment();
  const parts = text.split("QuoteCore+");

  parts.forEach((part, index) => {
    if (part) {
      fragment.appendChild(document.createTextNode(part));
    }

    if (index < parts.length - 1) {
      const brand = document.createElement("span");
      brand.className = "brand-wordmark";
      brand.dataset.quotecoreStyled = "true";
      brand.appendChild(document.createTextNode("QuoteCore"));

      const plus = document.createElement("span");
      plus.className = "brand-plus";
      plus.appendChild(document.createTextNode("+"));
      brand.appendChild(plus);

      fragment.appendChild(brand);
    }
  });

  parent.replaceChild(fragment, node);
}

function walkTextNodes(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    styleQuoteCoreTextNode(root as Text);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) {
    return;
  }

  if (root instanceof Element && root.closest(SKIP_SELECTOR)) {
    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current = walker.nextNode();

  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  textNodes.forEach(styleQuoteCoreTextNode);
}

export default function QuoteCorePlusStyler() {
  useEffect(() => {
    walkTextNodes(document.body);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData") {
          styleQuoteCoreTextNode(mutation.target as Text);
          return;
        }

        mutation.addedNodes.forEach(walkTextNodes);
      });
    });

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
