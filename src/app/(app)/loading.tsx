export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-secondary" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-28 animate-pulse rounded-2xl bg-secondary" />
        <div className="h-28 animate-pulse rounded-2xl bg-secondary" />
        <div className="h-28 animate-pulse rounded-2xl bg-secondary" />
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-secondary" />
    </div>
  );
}
