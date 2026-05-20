export default function ConsoleLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-9 w-56 animate-pulse rounded-full bg-muted" />
        <div className="h-5 w-80 animate-pulse rounded-full bg-muted" />
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl border bg-card" />
        ))}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="h-6 w-40 animate-pulse rounded-full bg-muted" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg bg-muted/70" />
          ))}
        </div>
      </div>
    </div>
  );
}