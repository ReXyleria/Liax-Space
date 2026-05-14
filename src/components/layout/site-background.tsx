import { cn } from "@/lib/utils";

const fallbackBackground = "https://photo.toliax.com/random";

export function resolveSiteBackground(settings: Record<string, string>) {
  return (
    settings["appearance.backgroundImage"]?.trim() ||
    settings["home.cover"]?.trim() ||
    fallbackBackground
  );
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
        className={cn("pointer-events-none fixed inset-0 -z-20 bg-center bg-cover bg-no-repeat", className)}
        style={{ backgroundImage: `url(${image})` }}
      />
      <div
        aria-hidden
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
