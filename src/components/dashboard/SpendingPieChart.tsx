"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";

interface CategoryItem {
  name: string;
  value: number;
  color: string;
  icon?: string;
}

interface SpendingPieChartProps {
  data: CategoryItem[];
  totalExpense: number;
}

const RADIAN = Math.PI / 180;

function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-foreground mb-1">
        {d.icon} {d.name}
      </p>
      <p className="text-muted-foreground">{formatCurrency(d.value)}</p>
    </div>
  );
}

export function SpendingPieChart({ data, totalExpense }: SpendingPieChartProps) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.value - a.value).slice(0, 8),
    [data]
  );

  if (sorted.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm border border-dashed border-border rounded-xl">
        Chưa có dữ liệu chi tiêu
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={sorted}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              dataKey="value"
              labelLine={false}
              label={CustomLabel}
              stroke="none"
            >
              {sorted.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend list */}
      <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
        {sorted.map((item) => {
          const pct = totalExpense > 0 ? ((item.value / totalExpense) * 100).toFixed(1) : "0";
          return (
            <div key={item.name} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-foreground font-medium truncate">
                  {item.icon} {item.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-muted-foreground">{pct}%</span>
                <span className="font-bold text-foreground">{formatCurrencyCompact(item.value)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
