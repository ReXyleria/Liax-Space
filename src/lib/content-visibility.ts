import { ContentVisibility } from "@prisma/client";
import type { Locale } from "@/lib/i18n-messages";

type VisibilityCopy = {
  label: string;
  description: string;
};

const zh: Record<ContentVisibility, VisibilityCopy> = {
  [ContentVisibility.PUBLIC]: {
    label: "公开",
    description: "所有访客都可以阅读。"
  },
  [ContentVisibility.LOGIN_REQUIRED]: {
    label: "登录后可见",
    description: "任意已登录用户都可以阅读。"
  },
  [ContentVisibility.SVIP_ONLY]: {
    label: "SVIP 及以上可见",
    description: "SVIP、SSVIP 和 Administer 可以阅读。"
  },
  [ContentVisibility.SSVIP_ONLY]: {
    label: "SSVIP 及以上可见",
    description: "SSVIP 和 Administer 可以阅读。"
  },
  [ContentVisibility.Administer_ONLY]: {
    label: "仅 Administer 可见",
    description: "只有最高权限账号可以阅读。"
  }
};

const en: Record<ContentVisibility, VisibilityCopy> = {
  [ContentVisibility.PUBLIC]: {
    label: "Public",
    description: "Every visitor can read it."
  },
  [ContentVisibility.LOGIN_REQUIRED]: {
    label: "Logged-in users",
    description: "Any signed-in user can read it."
  },
  [ContentVisibility.SVIP_ONLY]: {
    label: "SVIP and above",
    description: "SVIP, SSVIP, and Administer can read it."
  },
  [ContentVisibility.SSVIP_ONLY]: {
    label: "SSVIP and above",
    description: "SSVIP and Administer can read it."
  },
  [ContentVisibility.Administer_ONLY]: {
    label: "Administer only",
    description: "Only the highest-privilege account can read it."
  }
};

const badgeClasses: Record<ContentVisibility, string> = {
  [ContentVisibility.PUBLIC]: "bg-emerald-500/10 text-emerald-700",
  [ContentVisibility.LOGIN_REQUIRED]: "bg-sky-500/10 text-sky-700",
  [ContentVisibility.SVIP_ONLY]: "bg-violet-500/10 text-violet-700",
  [ContentVisibility.SSVIP_ONLY]: "bg-amber-500/10 text-amber-700",
  [ContentVisibility.Administer_ONLY]: "bg-rose-500/10 text-rose-700"
};

export function contentVisibilityCopy(locale: Locale, visibility: ContentVisibility) {
  return (locale === "en" ? en : zh)[visibility] ?? zh[ContentVisibility.PUBLIC];
}

export function contentVisibilityLabel(locale: Locale, visibility: ContentVisibility) {
  return contentVisibilityCopy(locale, visibility).label;
}

export function contentVisibilityOptions(locale: Locale) {
  return Object.values(ContentVisibility).map((value) => {
    const copy = contentVisibilityCopy(locale, value);
    return {
      value,
      label: copy.label,
      description: copy.description
    };
  });
}

export function contentVisibilityBadgeClass(visibility: ContentVisibility) {
  return badgeClasses[visibility] ?? "bg-muted text-muted-foreground";
}
