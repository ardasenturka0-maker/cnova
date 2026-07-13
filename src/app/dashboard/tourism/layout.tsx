import { TourismNav } from "@/components/dashboard/tourism-nav";

export default function TourismLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-6">
      <TourismNav />
      {children}
    </div>
  );
}
