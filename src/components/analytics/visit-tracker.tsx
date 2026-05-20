"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/console") || pathname.startsWith("/api")) {
      return;
    }

    const query = window.location.search.replace(/^\?/, "");
    const rawReferrer = document.referrer || "";
    // Treat same-origin referrers as direct traffic so internal navigation
    // doesn't pollute the "Other" category in search-engine-source charts.
    const referrer = rawReferrer && rawReferrer.startsWith(window.location.origin) ? "" : rawReferrer;
    const payload = JSON.stringify({
      path: query ? `${pathname}?${query}` : pathname,
      referrer
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/visit", blob);
      return;
    }

    void fetch("/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true
    });
  }, [pathname]);

  return null;
}
