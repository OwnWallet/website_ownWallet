"use client";

import { useState } from "react";
import { Trash2, X, Loader2, CheckSquare } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface BulkActionBarProps {
  selectedCount: number;
  itemName?: string;
  onClearSelection: () => void;
  onConfirmDelete: () => Promise<void> | void;
  children?: React.ReactNode;
}

export function BulkActionBar({
  selectedCount,
  itemName = "mục",
  onClearSelection,
  onConfirmDelete,
  children,
}: BulkActionBarProps) {
  const [openDialog, setOpenDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (selectedCount === 0) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirmDelete();
    } finally {
      setIsDeleting(false);
      setOpenDialog(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-xl animate-in fade-in slide-in-from-bottom-5 duration-200">
        <div className="bg-slate-900/95 text-slate-100 dark:bg-slate-800/95 dark:text-slate-100 backdrop-blur-md shadow-2xl rounded-2xl border border-white/10 px-4 py-3 sm:px-5 sm:py-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
          {/* Left: Info badge */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/25 text-primary border border-primary/30 text-xs font-extrabold shrink-0">
              <CheckSquare size={15} />
            </span>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold truncate">
                Đã chọn <strong className="text-primary font-black text-sm sm:text-base">{selectedCount}</strong> {itemName}
              </p>
              {children && (
                <div className="text-[11px] text-slate-400 truncate">
                  {children}
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button
              type="button"
              onClick={onClearSelection}
              disabled={isDeleting}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <X size={14} />
              <span>Bỏ chọn</span>
            </button>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={() => setOpenDialog(true)}
              className="px-3.5 py-1.5 h-auto text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-950/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Đang xóa...</span>
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  <span>Xóa ({selectedCount})</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
              <Trash2 size={18} /> Xác nhận xóa hàng loạt
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa vĩnh viễn{" "}
              <strong className="text-foreground font-bold">
                {selectedCount} {itemName}
              </strong>{" "}
              đã chọn không? Hành động này không thể hoàn tác và toàn bộ dữ liệu liên quan sẽ bị loại bỏ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} onClick={() => setOpenDialog(false)}>
              Hủy bỏ
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {isDeleting ? "Đang xóa..." : `Xác nhận xóa (${selectedCount})`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
