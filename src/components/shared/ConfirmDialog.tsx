'use client';

import React from 'react';
import Modal from './Modal';
import { AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
      <div className="flex items-start gap-4 mb-6">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isDangerous
            ? 'bg-[var(--ev-rose-soft)] text-[var(--ev-rose)] border border-[var(--ev-rose)]/20'
            : 'bg-[var(--ev-indigo-soft)] text-[var(--ev-indigo)] border border-[var(--ev-indigo)]/20'
        }`}>
          <AlertCircle className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <p className="text-[13px] text-[var(--ev-text-secondary)] pt-1 leading-relaxed">{message}</p>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-[var(--ev-surface-subtle)] hover:bg-[var(--ev-border)] text-[var(--ev-text-secondary)] text-[12px] font-semibold transition-colors duration-150"
        >
          {cancelText}
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`px-4 py-2 rounded-lg text-[12px] font-semibold text-white transition-all duration-150 shadow-sm ${
            isDangerous
              ? 'bg-[var(--ev-rose)] hover:bg-[var(--ev-rose)]/90'
              : 'bg-[var(--ev-indigo)] hover:bg-[var(--ev-indigo)]/90'
          }`}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
