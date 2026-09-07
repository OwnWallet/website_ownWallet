"use client";

import React from "react";
import { ExternalLink, Download, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  title?: string;
  subtitle?: string;
}

export function EvidenceModal({
  isOpen,
  onClose,
  imageUrl,
  title = "Bằng chứng giao dịch",
  subtitle,
}: EvidenceModalProps) {
  if (!imageUrl) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between space-y-0">
          <div>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileText size={16} className="text-primary" />
              <span>{title}</span>
            </DialogTitle>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              title="Mở tab mới"
            >
              <ExternalLink size={16} />
            </a>
            <a
              href={imageUrl}
              download="transaction-evidence"
              className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              title="Tải ảnh về"
            >
              <Download size={16} />
            </a>
          </div>
        </DialogHeader>

        {/* Image Preview Container */}
        <div className="relative flex-1 p-4 bg-muted/20 flex items-center justify-center overflow-auto max-h-[70vh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={title}
            className="max-h-full max-w-full object-contain rounded-lg shadow-sm border border-border/60"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
