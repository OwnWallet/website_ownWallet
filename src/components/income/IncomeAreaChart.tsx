"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface MonthData {
  month: string;
  monthNum: number;
  amount: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2.5 text-xs">
      <p className="font-bold text-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-muted-foreground">Thu nhập:</span>
        <span className="font-bold text-emerald-600">{formatCurrency(Number(payload[0].value))}</span>
      </div>
    </div>
  );
}

export function IncomeAreaChart({ data }: { data: MonthData[] }) {
  if (!data || data.every((d) => d.amount === 0)) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm border border-dashed border-border rounded-xl">
        Chưa có dữ liệu thu nhập
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.amount));

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
            </linearGradient>
          </defs>
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
            tickFormatter={(v) =>
              v >= 1_000_000
                ? `${(v / 1_000_000).toFixed(0)}tr`
                : v >= 1000
                ? `${(v / 1000).toFixed(0)}k`
                : String(v)
            }
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#059669"
            strokeWidth={2.5}
            fill="url(#incomeGradient)"
            dot={{ fill: "#059669", strokeWidth: 2, r: 3 }}
            activeDot={{ r: 5, fill: "#059669" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
