export default function GlobalLoading() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center px-6 py-16">
      <div className="w-full space-y-5">
        <div className="h-5 w-40 animate-pulse rounded-full bg-muted" />
        <div className="h-12 w-full max-w-2xl animate-pulse rounded-lg bg-muted" />
        <div className="h-5 w-full max-w-xl animate-pulse rounded-full bg-muted" />
        <div className="grid gap-4 pt-4 md:grid-cols-2">
          <div className="h-36 animate-pulse rounded-lg border bg-card" />
          <div className="h-36 animate-pulse rounded-lg border bg-card" />
        </div>
      </div>
    </div>
  );
}
