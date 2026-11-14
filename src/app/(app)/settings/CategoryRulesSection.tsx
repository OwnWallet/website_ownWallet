"use client";

import { useEffect, useState, useTransition } from "react";
import { Pin, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listCategoryRules, removeCategoryRule, type CategoryRuleView } from "@/actions/import-tools";

/**
 * Cài đặt → Quy tắc phân loại tự học (từ các lần sửa danh mục khi Import).
 */
export function CategoryRulesSection() {
  const [rules, setRules] = useState<CategoryRuleView[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    listCategoryRules()
      .then((r) => !cancelled && setRules(r))
      .catch(() => !cancelled && setRules([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = (rule: CategoryRuleView) => {
    setDeletingId(rule.id);
    startTransition(async () => {
      const res = await removeCategoryRule(rule.id);
      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        setRules((prev) => (prev ?? []).filter((r) => r.id !== rule.id));
        toast.success(`Đã xóa quy tắc "${rule.keyword}"`);
      }
      setDeletingId(null);
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Pin size={18} className="text-primary" />
        <h2 className="text-lg font-bold">Quy tắc phân loại (tự học khi Import)</h2>
      </div>

      <div className="card p-5 space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Khi bạn sửa danh mục của một giao dịch lúc Import, OwnWallet ghi nhớ từ khóa người bán
          (VD: <strong>HIGHLANDS COFFEE → Ăn uống</strong>) và tự áp dụng ở các lần Import sau — nhanh hơn và không cần AI.
          Xóa quy tắc nếu nó không còn đúng.
        </p>

        {rules === null ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
            <Loader2 size={14} className="animate-spin" /> Đang tải quy tắc…
          </div>
        ) : rules.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
            Chưa có quy tắc nào. Hãy sửa danh mục cho vài giao dịch ở bước xem lại khi Import.
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs bg-card">
                <div className="min-w-0 flex items-center gap-2 flex-wrap">
                  <code className="font-mono font-semibold text-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                    {rule.keyword}
                  </code>
                  <span className="text-muted-foreground">→</span>
                  {rule.categoryName ? (
                    <span className="font-medium">
                      {rule.categoryIcon ? `${rule.categoryIcon} ` : ""}
                      {rule.categoryName}
                    </span>
                  ) : (
                    <span className="text-rose-600 italic">Danh mục đã bị xóa (không áp dụng)</span>
                  )}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                      rule.txType === "INCOME"
                        ? "text-emerald-700 border-emerald-200 bg-emerald-50"
                        : "text-rose-700 border-rose-200 bg-rose-50"
                    }`}
                  >
                    {rule.txType === "INCOME" ? "Thu" : "Chi"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">đã dùng {rule.hits} lần</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(rule)}
                  disabled={deletingId === rule.id}
                  className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 cursor-pointer disabled:opacity-50"
                  aria-label={`Xóa quy tắc ${rule.keyword}`}
                  title="Xóa quy tắc"
                >
                  {deletingId === rule.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
