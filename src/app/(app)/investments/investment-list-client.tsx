"use client";

import { useState } from "react";
import { toast } from "sonner";
import { InvestmentCard } from "./investment-card";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { deleteInvestments } from "@/actions/investments";

interface InvestmentListClientProps {
  investments: any[];
  wallets?: any[];
}

export function InvestmentListClient({ investments, wallets = [] }: InvestmentListClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  if (investments.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">📈</span>
        <h2 className="empty-state-title">Chưa có khoản đầu tư nào</h2>
        <p className="empty-state-desc">Hãy thêm khoản đầu tư đầu tiên của bạn để theo dõi sinh lời.</p>
      </div>
    );
  }

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === investments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(investments.map((inv) => inv.id)));
    }
  };

  return (
    <div className="space-y-4">
      {/* Top toolbar for list selection */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-border-strong text-primary focus:ring-primary/30 cursor-pointer accent-primary"
            checked={selectedIds.size === investments.length && investments.length > 0}
            onChange={toggleSelectAll}
            id="select-all-investments"
          />
          <label htmlFor="select-all-investments" className="text-xs font-semibold text-muted-foreground cursor-pointer select-none">
            {selectedIds.size === investments.length ? "Bỏ chọn tất cả" : `Chọn tất cả (${investments.length})`}
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
        {investments.map((inv: any) => (
          <InvestmentCard
            key={inv.id}
            inv={inv}
            wallets={wallets}
            selected={selectedIds.has(inv.id)}
            onToggleSelect={() => toggleSelectOne(inv.id)}
          />
        ))}
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        itemName="tài sản đầu tư"
        onClearSelection={() => setSelectedIds(new Set())}
        onConfirmDelete={async () => {
          const res = await deleteInvestments(Array.from(selectedIds));
          if ((res as any)?.error) {
            toast.error((res as any).error);
          } else {
            toast.success(`Đã xóa thành công ${res.count ?? selectedIds.size} tài sản đầu tư`);
            setSelectedIds(new Set());
          }
        }}
      />
    </div>
  );
}
