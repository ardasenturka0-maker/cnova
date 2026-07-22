"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RevenuePoint = { month: string; gelir: number };
type DensityPoint = { gun: string; randevu: number };
type DistributionPoint = { name: string; value: number };
type DoctorPoint = { name: string; appointments: number; revenue: number };
type DashboardChartVisibility = { revenue: boolean; density: boolean; distribution: boolean; doctors: boolean };

const colors = ["#0f9f8f", "#f97316", "#64748b", "#eab308", "#2563eb", "#dc2626", "#14b8a6", "#a855f7"];

export function DashboardCharts({
  revenue,
  density,
  distribution,
  doctors,
  visible = { revenue: true, density: true, distribution: true, doctors: true }
}: {
  revenue: RevenuePoint[];
  density: DensityPoint[];
  distribution: DistributionPoint[];
  doctors: DoctorPoint[];
  visible?: DashboardChartVisibility;
}) {
  if (!Object.values(visible).some(Boolean)) return null;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {visible.revenue ? <Card>
        <CardHeader>
          <CardTitle>Aylık gelir</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenue}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="gelir" stroke="#0f9f8f" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card> : null}
      {visible.density ? <Card>
        <CardHeader>
          <CardTitle>Randevu yoğunluğu</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={density}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="gun" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="randevu" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card> : null}
      {visible.distribution ? <Card>
        <CardHeader>
          <CardTitle>Tedavi dağılımı</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={54} outerRadius={92} paddingAngle={3}>
                {distribution.map((entry, index) => (
                  <Cell key={entry.name} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card> : null}
      {visible.doctors ? <Card>
        <CardHeader>
          <CardTitle>Doktor performansı</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={doctors.slice(0, 6)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="appointments" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card> : null}
    </div>
  );
}
