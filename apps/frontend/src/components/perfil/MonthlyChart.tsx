import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const DATA = [
  { month: "Jan", conversions: 12 },
  { month: "Fev", conversions: 19 },
  { month: "Mar", conversions: 8 },
  { month: "Abr", conversions: 25 },
  { month: "Mai", conversions: 32 },
  { month: "Jun", conversions: 18 },
  { month: "Jul", conversions: 28 },
  { month: "Ago", conversions: 15 },
  { month: "Set", conversions: 22 },
  { month: "Out", conversions: 30 },
  { month: "Nov", conversions: 27 },
  { month: "Dez", conversions: 35 },
];

export function MonthlyChart() {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={DATA}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--comic-ink)" opacity={0.15} />
          <XAxis
            dataKey="month"
            tick={{ fontFamily: "var(--font-display)", fontSize: 12 }}
            stroke="var(--comic-ink)"
          />
          <YAxis
            tick={{ fontFamily: "var(--font-display)", fontSize: 12 }}
            stroke="var(--comic-ink)"
          />
          <Tooltip
            contentStyle={{
              border: "3px solid var(--comic-ink)",
              borderRadius: "8px",
              boxShadow: "3px 3px 0 0 var(--comic-ink)",
              fontFamily: "var(--font-display)",
              background: "var(--comic-yellow)",
            }}
          />
          <Bar dataKey="conversions" fill="var(--comic-red)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
