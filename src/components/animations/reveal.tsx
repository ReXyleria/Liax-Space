import { cn } from "@/lib/utils";

export function MotionPage({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("motion-page-enter", className)}>{children}</div>;
}

export function MotionList({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("motion-list-enter", className)}>{children}</div>;
}

export function MotionItem({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("motion-item-enter", className)}>{children}</div>;
}
