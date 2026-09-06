"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface MonthData {
  month: string;
  income: number;
  expense: number;
}

interface Props {
  data: MonthData[];
}

export function MonthComparisonChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-xl border-border">
        Chưa có dữ liệu so sánh
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748b", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748b", fontSize: 12 }}
            tickFormatter={(value) => `${(value / 1000000).toFixed(0)}tr`}
            width={50}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.08)",
              fontSize: "12px",
              color: "#0f172a",
            }}
            formatter={(value: any) => [formatCurrency(Number(value)), ""]}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
            formatter={(val) => (val === "income" ? "Thu nhập" : "Chi tiêu")}
          />
          <Bar dataKey="income" name="income" fill="#059669" radius={[6, 6, 0, 0]} maxBarSize={36} />
          <Bar dataKey="expense" name="expense" fill="#e11d48" radius={[6, 6, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
