export default function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-5 text-center shadow-sm">
        <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-md bg-primary/20" />
        <p className="font-medium">ClinicNova hazırlanıyor</p>
        <p className="mt-1 text-sm text-muted-foreground">Veriler yükleniyor.</p>
      </div>
    </div>
  );
}
