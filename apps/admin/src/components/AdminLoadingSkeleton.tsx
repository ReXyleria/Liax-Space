import type { ReactElement } from "react";

export type AdminLoadingSkeletonVariant = "cards" | "list" | "table";

export type AdminLoadingSkeletonProps = {
  label: string;
  rows?: number;
  variant?: AdminLoadingSkeletonVariant;
};

export function AdminLoadingSkeleton({ label, rows = 4, variant = "table" }: AdminLoadingSkeletonProps): ReactElement {
  const rowCount = Math.max(1, Math.trunc(rows));

  return (
    <div aria-label={label} className={`admin-loading-skeleton admin-loading-skeleton--${variant}`} role="status">
      <span className="admin-sr-only">{label}</span>
      {Array.from({ length: rowCount }, (_, rowIndex) => (
        <div className="admin-loading-skeleton__item" key={rowIndex}>
          <span className="admin-loading-skeleton__line" />
          <span className="admin-loading-skeleton__line" />
          <span className="admin-loading-skeleton__line" />
        </div>
      ))}
    </div>
  );
}