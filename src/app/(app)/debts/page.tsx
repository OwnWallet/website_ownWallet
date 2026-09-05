import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency, formatDate, calcPercent } from "@/lib/utils";
import { DebtActions } from "./debt-actions";
import { deleteDebt } from "@/actions/debts";
import { Trash2 } from "lucide-react";

export const metadata = {
  title: "Quản lý Nợ | wnWallet",
};

export default async function DebtsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  let debts: any[] = [];
  try {
    debts = await db.orm.public.Debt
      .where((d) => d.userId.eq(userId))
      .orderBy((d) => d.createdAt.desc())
      .all();
  } catch (error) {
    console.error("Failed to fetch debts:", error);
    return (
      <div className="p-8 text-center" style={{ color: "var(--color-expense)" }}>
        Đã có lỗi xảy ra khi tải dữ liệu nợ.
      </div>
    );
  }

  const owes = debts.filter((d) => d.direction === "OWE");
  const oweds = debts.filter((d) => d.direction === "OWED");

  const totalOwe = owes.reduce((sum, d) => sum + Number(d.amount) - Number(d.paidAmount), 0);
  const totalOwed = oweds.reduce((sum, d) => sum + Number(d.amount) - Number(d.paidAmount), 0);

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Quản lý Nợ</h1>
          <p className="text-muted text-sm mt-1">Theo dõi các khoản vay và cho vay</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          className="card bg-elevated flex flex-col items-center justify-center py-6"
          style={{ border: "1px solid var(--border-strong)" }}
        >
          <span className="text-muted text-sm mb-1">Tổng nợ phải trả</span>
          <span className="text-3xl font-extrabold text-expense">{formatCurrency(totalOwe)}</span>
        </div>
        <div
          className="card bg-elevated flex flex-col items-center justify-center py-6"
          style={{ border: "1px solid var(--border-strong)" }}
        >
          <span className="text-muted text-sm mb-1">Tổng nợ phải thu</span>
          <span className="text-3xl font-extrabold text-income">{formatCurrency(totalOwed)}</span>
        </div>
      </div>

      <DebtActions />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
        {/* OWE */}
        <div>
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-border-strong">
            Tôi nợ ({owes.length})
          </h2>
          {owes.length === 0 ? (
            <div className="text-center p-8 card border-dashed">
              <div className="text-4xl mb-2">😌</div>
              <p className="text-muted text-sm">Bạn không nợ ai cả</p>
            </div>
          ) : (
            <div className="space-y-4">
              {owes.map((d) => (
                <DebtCard key={d.id} debt={d} />
              ))}
            </div>
          )}
        </div>

        {/* OWED */}
        <div>
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-border-strong">
            Người nợ tôi ({oweds.length})
          </h2>
          {oweds.length === 0 ? (
            <div className="text-center p-8 card border-dashed">
              <div className="text-4xl mb-2">🪹</div>
              <p className="text-muted text-sm">Không có ai nợ bạn</p>
            </div>
          ) : (
            <div className="space-y-4">
              {oweds.map((d) => (
                <DebtCard key={d.id} debt={d} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DebtCard({ debt }: { debt: any }) {
  const amount = Number(debt.amount);
  const paid = Number(debt.paidAmount);
  const remain = Math.max(0, amount - paid);
  const percent = calcPercent(paid, amount);

  let statusColor = "var(--foreground-muted)";
  let statusText = "Chờ trả";
  if (debt.status === "PAID") {
    statusColor = "var(--color-income)";
    statusText = "Đã xong";
  } else if (debt.status === "PARTIAL") {
    statusColor = "var(--color-debt)";
    statusText = "Trả 1 phần";
  }

  const isOverdue = debt.dueDate && new Date(debt.dueDate) < new Date() && debt.status !== "PAID";

  return (
    <div className="card relative flex flex-col gap-3 group">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-base">{debt.person}</h3>
          {debt.note && <p className="text-xs text-muted mt-0.5">{debt.note}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded"
            style={{
              backgroundColor: `color-mix(in srgb, ${statusColor} 15%, transparent)`,
              color: statusColor,
              border: `1px solid color-mix(in srgb, ${statusColor} 30%, transparent)`,
            }}
          >
            {statusText}
          </span>
          <form
            action={async () => {
              "use server";
              await deleteDebt(debt.id);
            }}
          >
            <button
              type="submit"
              title="Xóa khoản nợ"
              className="p-1 rounded text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          </form>
        </div>
      </div>

      <div className="flex justify-between text-xs">
        <span className="text-muted">
          Số tiền: <strong className="text-foreground">{formatCurrency(amount)}</strong>
        </span>
        <span className="text-muted">
          Còn lại:{" "}
          <strong style={{ color: debt.direction === "OWE" ? "var(--color-expense)" : "var(--color-income)" }}>
            {formatCurrency(remain)}
          </strong>
        </span>
      </div>

      <div className="h-2 w-full bg-elevated rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${percent}%`,
            backgroundColor: statusColor,
          }}
        />
      </div>

      <div className="flex justify-between items-center mt-1">
        <div className="text-xs">
          {debt.dueDate ? (
            <span style={{ color: isOverdue ? "var(--color-expense)" : "var(--foreground-subtle)" }}>
              Hạn: {formatDate(debt.dueDate)} {isOverdue && "⚠️ Quá hạn"}
            </span>
          ) : (
            <span className="text-muted text-xs">Không có hạn</span>
          )}
        </div>

        {debt.status !== "PAID" && (
          <DebtActions debtId={debt.id} inline mode="record" />
        )}
      </div>
    </div>
  );
}
