"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";

interface MonthData {
  month: string;
  income: number;
  expense: number;
}

interface CashFlowTrendChartProps {
  data: MonthData[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2.5 text-xs space-y-1.5 min-w-[160px]">
      <p className="font-bold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
          </div>
          <span className="font-semibold text-foreground">{formatCurrency(Number(p.value))}</span>
        </div>
      ))}
      {payload.length === 2 && (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-1.5 mt-0.5">
          <span className="text-muted-foreground">Số dư ròng</span>
          <span className={`font-bold ${payload[0].value - payload[1].value >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {formatCurrency(Number(payload[0].value) - Number(payload[1].value))}
          </span>
        </div>
      )}
    </div>
  );
}

export function CashFlowTrendChart({ data }: CashFlowTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm border border-dashed border-border rounded-xl">
        Chưa có đủ dữ liệu lịch sử
      </div>
    );
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }} barGap={3} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748b", fontSize: 11 }}
            dy={6}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748b", fontSize: 11 }}
            tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}tr`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="income" name="Thu nhập" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="expense" name="Chi tiêu" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
