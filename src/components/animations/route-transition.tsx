"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

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
  const [phase, setPhase] = useState<"idle" | "exit" | "enter">("idle");
  const prevPathname = useRef(pathname);
  const isAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      if (isInternalNavigation(event.target)) {
        setNavigating(true);
        setPhase("exit");
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  useEffect(() => {
    if (navigating) {
      prevPathname.current = pathname;
      const enterTimer = window.setTimeout(() => {
        setPhase("enter");
      }, 200);
      const doneTimer = window.setTimeout(() => {
        setNavigating(false);
        setPhase("idle");
      }, 600);
      return () => {
        window.clearTimeout(enterTimer);
        window.clearTimeout(doneTimer);
      };
    }
  }, [pathname, navigating]);

  return (
    <>
      {/* Top progress bar - subtle, elegant */}
      <div
        aria-hidden="true"
        className="fixed left-0 top-0 z-[70] h-[2px] w-full origin-left bg-gradient-to-r from-primary/80 via-accent to-primary/80"
        style={{
          opacity: navigating ? 1 : 0,
          transform: navigating ? "scaleX(1)" : "scaleX(0)",
          transition: navigating
            ? "transform 1.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 150ms ease-out"
            : "transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-in"
        }}
      />

      {/* Subtle page dim overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[55] bg-background/20 backdrop-blur-[2px] motion-reduce:hidden"
        style={{
          opacity: phase === "exit" ? 1 : 0,
          transition: "opacity 350ms cubic-bezier(0.4, 0, 0.2, 1)"
        }}
      />

      {/* Page content with smooth crossfade */}
      {/* Admin routes skip key-based animation so the sidebar layout stays mounted */}
      {isAdmin ? (
        <>{children}</>
      ) : (
        <div key={pathname} className="route-transition-public">
          {children}
        </div>
      )}
    </>
  );
}
