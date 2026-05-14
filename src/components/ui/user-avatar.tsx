import { cn } from "@/lib/utils";

export function UserAvatar({
  src,
  name,
  className
}: {
  src?: string | null;
  name: string;
  className?: string;
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
              backgroundSize: "cover",
              backgroundPosition: "center"
            }
          : undefined
      }
    >
      {src ? null : name.slice(0, 1).toUpperCase()}
    </span>
  );
}
