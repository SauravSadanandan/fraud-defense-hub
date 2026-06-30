import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardState } from "@/engine/types";

const PIE_COLORS = [
  "var(--fraud-click)",
  "var(--fraud-bot)",
  "var(--fraud-hijack)",
  "var(--chart-5)",
  "var(--fraud-warn)",
  "var(--fraud-ok)",
];

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">{label}</div>
  );
}

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

export function DashboardCharts({ data, selectedPid }: { data: DashboardState; selectedPid: string }) {
  const reasonData = Object.entries(data.byReason)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  const topSource =
    selectedPid === "All"
      ? Object.entries(data.byMedia)
      : Object.entries(data.bySiteId);
  const barData = topSource
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));

  const ctitData = Object.entries(data.ctitBuckets).map(([name, value]) => ({ name, value }));
  const hasCtit = ctitData.some((d) => d.value > 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-sm">Fraud Reason Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {reasonData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={reasonData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                  {reasonData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No fraud reasons found" />
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-sm">
            {selectedPid === "All" ? "Top 10 Media Sources" : `Top 10 Site IDs — ${selectedPid}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {barData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--accent)" }} />
                <Bar dataKey="value" fill="var(--primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No site/source data for this view" />
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm">CTIT (Click-to-Install Time) Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {hasCtit ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ctitData} margin={{ left: 0, right: 16 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--accent)" }} />
                <Bar dataKey="value" fill="var(--fraud-warn)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No CTIT data available" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}