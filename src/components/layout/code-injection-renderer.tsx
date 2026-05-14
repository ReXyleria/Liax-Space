"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function removeManagedNodes() {
  document.querySelectorAll("[data-code-injection-managed='true']").forEach((node) => node.remove());
}

function appendHtmlToHead(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  Array.from(template.content.childNodes).forEach((node) => {
    const clone = node.cloneNode(true);
    if (clone instanceof HTMLElement) {
      clone.dataset.codeInjectionManaged = "true";
    }
    document.head.appendChild(clone);
  });
}

function appendCss(css: string) {
  if (!css.trim()) {
    return;
  }

  const style = document.createElement("style");
  style.dataset.codeInjectionManaged = "true";
  style.textContent = css;
  document.head.appendChild(style);
}

function appendJs(js: string) {
  if (!js.trim()) {
    return;
  }

  const script = document.createElement("script");
  script.dataset.codeInjectionManaged = "true";
  script.text = `try {\n${js}\n} catch (error) { console.error("Code injection script failed", error); }`;
  document.head.appendChild(script);
}

export function CodeInjectionRenderer({
  globalHead,
  articleHead,
  globalFooter,
  customHtml = "",
  customCss = "",
  customJs = "",
  mode = "all"
}: {
  globalHead: string;
  articleHead: string;
  globalFooter: string;
  customHtml?: string;
  customCss?: string;
  customJs?: string;
  mode?: "all" | "head" | "footer";
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(96);
  const footerSrcDoc = useMemo(() => {
    const html = [globalFooter, customHtml].filter(Boolean).join("\n");
    const baseCss = "<style>html,body{margin:0;padding:0;background:transparent;color:inherit;font:inherit;}*{box-sizing:border-box;}iframe{border:0;}</style>";
    const resizeScript = `<script>try{const send=()=>parent.postMessage({type:"code-injection-height",height:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight,1)},"*");new ResizeObserver(send).observe(document.body);window.addEventListener("load",send);setTimeout(send,60);}catch(error){console.error("Code injection resize failed",error);}</script>`;
    const css = customCss ? `<style>${customCss}</style>` : "";
    const js = customJs
      ? `<script>try {${customJs}} catch (error) { console.error("Code injection iframe script failed", error); }</script>`
      : "";
    return `${baseCss}${css}${html}${js}${resizeScript}`;
  }, [customCss, customHtml, customJs, globalFooter]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        typeof event.data === "object" &&
        event.data?.type === "code-injection-height" &&
        typeof event.data.height === "number"
      ) {
        setIframeHeight(Math.min(Math.max(event.data.height, 1), 800));
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (mode === "footer") {
      return;
    }

    try {
      removeManagedNodes();
      appendHtmlToHead(globalHead);
      if (pathname.startsWith("/articles/")) {
        appendHtmlToHead(articleHead);
      }
      appendCss(customCss);
      appendJs(customJs);
    } catch (error) {
      console.error("Code injection failed", error);
    }

    return () => {
      removeManagedNodes();
    };
  }, [articleHead, customCss, customJs, globalHead, mode, pathname]);

  if (mode === "head" || !mounted || !footerSrcDoc.trim()) {
    return null;
  }

  return (
    <div data-code-injection="footer" className="overflow-hidden bg-transparent">
      <iframe
        title="Custom footer code"
        sandbox="allow-scripts allow-same-origin"
        srcDoc={footerSrcDoc}
        className="block w-full border-0 bg-transparent"
        style={{ height: iframeHeight }}
      />
    </div>
  );
}
