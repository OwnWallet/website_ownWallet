"use client";

import { useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { DebtCard } from "./debt-card";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { deleteDebts } from "@/actions/debts";

interface DebtListClientProps {
  owes: any[];
  oweds: any[];
}

export function DebtListClient({ owes, oweds }: DebtListClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllOwes = () => {
    const ids = owes.map((d) => d.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectAllOweds = () => {
    const ids = oweds.map((d) => d.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* OWE */}
        <div>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center">
                <TrendingDown size={14} className="text-rose-600" />
              </div>
              <h2 className="text-base font-bold text-foreground">
                Tôi nợ <span className="text-muted-foreground font-normal text-sm ml-1">({owes.length})</span>
              </h2>
            </div>
            {owes.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAllOwes}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
              >
                {owes.every((d) => selectedIds.has(d.id)) ? "Bỏ chọn nhóm này" : "Chọn tất cả nợ phải trả"}
              </button>
            )}
          </div>
          {owes.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">😌</span>
              <p className="empty-state-desc">Bạn không nợ ai cả</p>
            </div>
          ) : (
            <div className="space-y-3 stagger-children">
              {owes.map((d: any) => (
                <DebtCard
                  key={d.id}
                  debt={d}
                  selected={selectedIds.has(d.id)}
                  onToggleSelect={() => toggleSelectOne(d.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* OWED */}
        <div>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrendingUp size={14} className="text-emerald-600" />
              </div>
              <h2 className="text-base font-bold text-foreground">
                Người nợ tôi <span className="text-muted-foreground font-normal text-sm ml-1">({oweds.length})</span>
              </h2>
            </div>
            {oweds.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAllOweds}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
              >
                {oweds.every((d) => selectedIds.has(d.id)) ? "Bỏ chọn nhóm này" : "Chọn tất cả nợ phải thu"}
              </button>
            )}
          </div>
          {oweds.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">🪹</span>
              <p className="empty-state-desc">Không có ai nợ bạn</p>
            </div>
          ) : (
            <div className="space-y-3 stagger-children">
              {oweds.map((d: any) => (
                <DebtCard
                  key={d.id}
                  debt={d}
                  selected={selectedIds.has(d.id)}
                  onToggleSelect={() => toggleSelectOne(d.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        itemName="khoản nợ"
        onClearSelection={() => setSelectedIds(new Set())}
        onConfirmDelete={async () => {
          const res = await deleteDebts(Array.from(selectedIds));
          if ((res as any)?.error) {
            toast.error((res as any).error);
          } else {
            toast.success(`Đã xóa thành công ${res.count ?? selectedIds.size} khoản nợ`);
            setSelectedIds(new Set());
          }
        }}
      />
    </>
  );
}
