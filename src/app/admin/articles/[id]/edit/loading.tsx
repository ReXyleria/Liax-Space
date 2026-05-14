import { Card } from "@/components/ui/card";

export default function EditArticleLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="h-[560px] animate-pulse bg-muted/60" />
        <Card className="h-[420px] animate-pulse bg-muted/60" />
      </div>
    </div>
  );
}
