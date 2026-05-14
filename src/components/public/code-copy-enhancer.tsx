"use client";

import { useEffect } from "react";

export function CodeCopyEnhancer() {
  useEffect(() => {
    const blocks = Array.from(document.querySelectorAll<HTMLElement>(".prose-content pre"));
    const cleanup: Array<() => void> = [];

    blocks.forEach((block) => {
      if (block.querySelector(".article-code-copy")) {
        return;
      }

      block.classList.add("article-code-block");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "article-code-copy";
      button.textContent = "复制";
      const onClick = async () => {
        const code = block.querySelector("code")?.textContent ?? block.textContent ?? "";
        await navigator.clipboard.writeText(code);
        button.textContent = "已复制";
        window.setTimeout(() => {
          button.textContent = "复制";
        }, 1200);
      };

      button.addEventListener("click", onClick);
      block.appendChild(button);
      cleanup.push(() => {
        button.removeEventListener("click", onClick);
        button.remove();
      });
    });

    return () => cleanup.forEach((dispose) => dispose());
  }, []);

  return null;
}
