"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function isInternalNavigation(target: EventTarget | null) {
  const element = target instanceof Element ? target.closest("a") : null;
  if (!(element instanceof HTMLAnchorElement)) {
    return false;
  }

  if (element.target || element.hasAttribute("download")) {
    return false;
  }

  const href = element.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }

  return element.origin === window.location.origin && element.href !== window.location.href;
}

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navigating, setNavigating] = useState(false);
  const isAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      if (isInternalNavigation(event.target)) {
        setNavigating(true);
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setNavigating(false), 240);
    return () => window.clearTimeout(timeout);
  }, [pathname]);

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed left-0 top-0 z-[70] h-0.5 w-full origin-left bg-gradient-to-r from-primary via-accent to-primary transition-all duration-300 ease-out"
        style={{
          opacity: navigating ? 1 : 0,
          transform: navigating ? "scaleX(1)" : "scaleX(0)"
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[55] bg-background/35 backdrop-blur-sm transition-opacity duration-200 motion-reduce:hidden"
        style={{ opacity: navigating ? (isAdmin ? 0.08 : 0.12) : 0 }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-y-0 left-0 z-[56] w-1/3 bg-gradient-to-r from-primary/14 via-accent/10 to-transparent blur-2xl transition-transform duration-500 ease-out motion-reduce:hidden"
        style={{
          transform: navigating ? "translateX(260%) skewX(-10deg)" : "translateX(-120%) skewX(-10deg)",
          opacity: navigating ? 1 : 0
        }}
      />
      <div key={pathname} className={isAdmin ? "route-transition-admin" : "route-transition-public"}>
        {children}
      </div>
    </>
  );
}
