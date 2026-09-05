"use client";

import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { motion } from "framer-motion";

interface Transaction {
  amount: string | number | { toString: () => string };
  type: string;
  recordedAt: Date;
}

interface Props {
  transactions: Transaction[];
}

export function DashboardChart({ transactions }: Props) {
  const data = useMemo(() => {
    // Group transactions by day
    const grouped = transactions.reduce((acc, tx) => {
      const d = new Date(tx.recordedAt);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const displayDate = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

      if (!acc[dayKey]) {
        acc[dayKey] = { dayKey, date: displayDate, income: 0, expense: 0, timestamp: d.getTime() };
      }
      const amt = Number(tx.amount);
      if (tx.type === "INCOME") acc[dayKey].income += amt;
      else if (tx.type === "EXPENSE") acc[dayKey].expense += amt;
      return acc;
    }, {} as Record<string, { dayKey: string, date: string, income: number, expense: number, timestamp: number }>);

    // Sort by date chronologically
    return Object.values(grouped).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  }, [transactions]);

  if (data.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm border border-dashed border-border rounded-xl">
        Chưa có đủ dữ liệu giao dịch trong tháng để vẽ biểu đồ
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="h-[300px] w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#059669" stopOpacity={0.25}/>
              <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#e11d48" stopOpacity={0.25}/>
              <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "#64748b", fontSize: 12 }} 
            dy={8}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "#64748b", fontSize: 12 }}
            tickFormatter={(value) => `${(value / 1000).toLocaleString("vi-VN")}k`}
            width={60}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.08)",
              fontSize: "12px",
              color: "#0f172a",
              padding: "8px 12px",
            }}
            formatter={(value: any) => [formatCurrency(Number(value)), ""]}
            labelStyle={{ color: "#0f172a", fontWeight: 700, marginBottom: "4px" }}
          />
          <Area 
            type="monotone" 
            dataKey="income" 
            name="Thu nhập" 
            stroke="#059669" 
            strokeWidth={2.5}
            fillOpacity={1} 
            fill="url(#colorIncome)" 
          />
          <Area 
            type="monotone" 
            dataKey="expense" 
            name="Chi tiêu" 
            stroke="#e11d48" 
            strokeWidth={2.5}
            fillOpacity={1} 
            fill="url(#colorExpense)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
