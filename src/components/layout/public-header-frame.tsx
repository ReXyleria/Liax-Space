"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function PublicHeaderFrame({
  children,
  transparentHeader = false,
  autoHideOnScroll = false
}: {
  children: React.ReactNode;
  transparentHeader?: boolean;
  autoHideOnScroll?: boolean;
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!autoHideOnScroll) {
      setHidden(false);
      return;
    }

    let previousY = window.scrollY;
    let ticking = false;

    function update() {
      const currentY = window.scrollY;
      const delta = currentY - previousY;

      if (window.innerWidth >= 768 && Math.abs(delta) > 8) {
        setHidden(delta > 0 && currentY > 96);
      } else if (window.innerWidth < 768) {
        setHidden(false);
      }

      previousY = currentY;
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [autoHideOnScroll]);

  return (
    <header
      className={cn(
        "top-0 z-30 w-full border-b backdrop-blur-xl transition-[transform,opacity,background-color,border-color] duration-700 ease-out",
        transparentHeader ? "fixed border-white/10 bg-transparent text-white" : "sticky border-white/70 bg-background/72",
        autoHideOnScroll && hidden && "md:-translate-y-full md:opacity-0"
      )}
    >
      {children}
    </header>
  );
}
