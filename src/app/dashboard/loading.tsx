export default function DashboardLoading() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-72 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-lg bg-muted" />)}
      </div>
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
