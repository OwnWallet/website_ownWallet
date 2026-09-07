"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { formatCurrency, formatMetric } from "@/lib/utils";

interface CategoryData {
  name: string;
  value: number;
  color: string;
  icon?: string | null;
  [key: string]: any;
}

interface Props {
  data: CategoryData[];
}

export function CategoryPieChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-xl border-border">
        Chưa có dữ liệu chi tiêu trong kỳ
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={95}
            paddingAngle={3}
            dataKey="value"
            stroke="#ffffff"
            strokeWidth={2}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || "#ea580c"} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload as CategoryData;
                const percent = total > 0 ? formatMetric((item.value / total) * 100) : "0";
                return (
                  <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-lg text-xs space-y-1">
                    <p className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{item.icon}</span>
                      <span>{item.name}</span>
                    </p>
                    <p className="text-slate-800 font-semibold">
                      {formatCurrency(item.value)} ({percent}%)
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
