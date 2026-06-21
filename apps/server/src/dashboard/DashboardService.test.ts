import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DashboardService } from "./DashboardService.js";

describe("DashboardService", () => {
  it("summarizes login countries, login users, and detailed operating systems from login audit events", async () => {
    const dashboardRepository = {
      getLoginTotals: async () => ({ loginEvents: 3, loginUsers: 2 }),
      getTotals: async () => ({
        articles: 4,
        comments: 0,
        guestbook: 1,
        moments: 2,
        users: 2
      }),
      listLoginAuditEvents: async () => [
        { country: "CN", createdAt: new Date("2026-06-18T08:00:00.000Z"), operatingSystem: "Windows 10/11 (NT 10.0)", userId: 1 },
        { country: "CN", createdAt: new Date("2026-06-18T08:10:00.000Z"), operatingSystem: "iOS 17.5", userId: 2 },
        { country: "US", createdAt: new Date("2026-06-18T08:20:00.000Z"), operatingSystem: "iOS 17.5", userId: 1 }
      ],
      listRecentPublishedArticles: async () => []
    };
    const visitRepository = {
      listPopularPages: async () => [{ path: "/zh/posts/example", visits: 5 }]
    };
    const service = new DashboardService(dashboardRepository as never, visitRepository as never);

    const summary = await service.getSummary(7);

    assert.deepEqual(summary.totals.loginEvents, 3);
    assert.deepEqual(summary.totals.loginUsers, 2);
    assert.deepEqual(summary.loginCountries, [
      { label: "CN", visits: 2 },
      { label: "US", visits: 1 }
    ]);
    assert.deepEqual(summary.loginDevices, [
      { label: "iOS 17.5", visits: 2 },
      { label: "Windows 10/11 (NT 10.0)", visits: 1 }
    ]);
    assert.deepEqual(summary.popularPages, [{ path: "/zh/posts/example", visits: 5 }]);
  });
});
