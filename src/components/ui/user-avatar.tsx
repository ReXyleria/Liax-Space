import { cn } from "@/lib/utils";

export function UserAvatar({
  src,
  name,
  className,
  fit = "cover"
}: {
  src?: string | null;
  name: string;
  className?: string;
  fit?: "cover" | "contain";
}) {
  return (
    <span
      className={cn(
        "grid place-items-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary",
        className
      )}
      style={
        src
          ? {
              backgroundImage: `url(${src})`,
              backgroundSize: fit,
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat"
            }
          : undefined
      }
    >
      {src ? null : name.slice(0, 1).toUpperCase()}
    </span>
  );
}
