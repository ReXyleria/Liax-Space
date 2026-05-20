import { cn } from "@/lib/utils";

export const fallbackBackground = "https://photo.toliax.com/random";

export type SiteBackgroundSource = "global" | "homepage" | "random" | "default";

export type SiteBackgroundResolution = {
  src: string;
  source: SiteBackgroundSource;
  settingKey?: string;
};

export function resolveSiteBackgroundDetails(settings: Record<string, string>): SiteBackgroundResolution {
  const globalBackground = settings["appearance.backgroundImage"]?.trim();
  if (globalBackground) {
    return {
      src: globalBackground,
      source: "global",
      settingKey: "appearance.backgroundImage"
    };
  }

  const homepageBackground = settings["home.cover"]?.trim();
  if (homepageBackground) {
    return {
      src: homepageBackground,
      source: "homepage",
      settingKey: "home.cover"
    };
  }

  if (settings["home.randomBackground"] !== "false") {
    return {
      src: settings["home.randomBackgroundUrl"]?.trim() || fallbackBackground,
      source: "random",
      settingKey: "home.randomBackgroundUrl"
    };
  }

  return {
    src: fallbackBackground,
    source: "default"
  };
}

export function resolveSiteBackground(settings: Record<string, string>) {
  return resolveSiteBackgroundDetails(settings).src;
}

export function SiteBackground({
  src,
  variant = "frosted",
  className
}: {
  src?: string;
  variant?: "home" | "frosted" | "auth";
  className?: string;
}) {
  const image = src?.trim() || fallbackBackground;

  return (
    <>
      <div
        aria-hidden
        data-site-background="image"
        className={cn("pointer-events-none fixed inset-0 -z-20 bg-center bg-cover bg-no-repeat", className)}
        style={{
          backgroundImage: `url(${image})`,
          backgroundAttachment: "scroll",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover"
        }}
      />
      <div
        aria-hidden
        data-site-background="overlay"
        className="pointer-events-none fixed inset-0 -z-10"
        style={
          variant === "home" || variant === "auth"
            ? {
                background:
                  "linear-gradient(115deg, rgb(3 7 18 / var(--site-background-overlay-opacity)), rgb(15 23 42 / calc(var(--site-background-overlay-opacity) * 0.55)) 45%, rgb(30 41 59 / calc(var(--site-background-overlay-opacity) * 0.2)))",
                backdropFilter: variant === "auth" ? "blur(var(--site-background-blur))" : undefined,
                WebkitBackdropFilter: variant === "auth" ? "blur(var(--site-background-blur))" : undefined
              }
            : {
                backgroundColor: "hsl(var(--background) / var(--site-background-overlay-opacity))",
                backdropFilter: "blur(var(--site-background-blur))",
                WebkitBackdropFilter: "blur(var(--site-background-blur))"
              }
        }
      />
    </>
  );
}
