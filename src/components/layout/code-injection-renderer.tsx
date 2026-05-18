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

export function CodeInjectionRenderer({
  articleHead,
  globalFooter,
  mode = "all"
}: {
  articleHead: string;
  globalFooter: string;
  mode?: "all" | "head" | "footer";
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(96);
  const footerSrcDoc = useMemo(() => {
    if (!globalFooter.trim()) {
      return "";
    }

    const baseCss = "<style>html,body{margin:0;padding:0;background:transparent;color:inherit;font:inherit;}*{box-sizing:border-box;}iframe{border:0;}</style>";
    const resizeScript = `<script>try{const send=()=>parent.postMessage({type:"code-injection-height",height:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight,1)},"*");new ResizeObserver(send).observe(document.body);window.addEventListener("load",send);setTimeout(send,60);}catch(error){console.error("Code injection resize failed",error);}<\/script>`;
    return `${baseCss}${globalFooter}${resizeScript}`;
  }, [globalFooter]);

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
      if (/^\/(?:zh-CN|en-US)\/articles\//.test(pathname)) {
        appendHtmlToHead(articleHead);
      }
    } catch (error) {
      console.error("Code injection failed", error);
    }

    return () => {
      removeManagedNodes();
    };
  }, [articleHead, mode, pathname]);

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
