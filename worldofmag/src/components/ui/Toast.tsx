"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let _counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++_counter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed right-4 z-[60] flex flex-col gap-2 pointer-events-none"
        style={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => setToasts((p) => p.filter((t) => t.id !== toast.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    return () => {};
  }, []);

  const icon = {
    success: <CheckCircle2 size={14} style={{ color: "var(--accent-green)", flexShrink: 0 }} />,
    error: <AlertCircle size={14} style={{ color: "var(--accent-red)", flexShrink: 0 }} />,
    info: <Info size={14} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />,
  }[toast.type];

  const bg = {
    success: "rgba(34,197,94,0.15)",
    error: "rgba(239,68,68,0.15)",
    info: "rgba(59,130,246,0.15)",
  }[toast.type];

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg pointer-events-auto"
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: `1px solid ${bg}`,
        maxWidth: 300,
        fontSize: 13,
        color: "var(--text-primary)",
        animation: "fadeIn 0.15s ease",
      }}
    >
      {icon}
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button onClick={onDismiss} style={{ color: "var(--text-muted)", flexShrink: 0, background: "none", border: "none", cursor: "pointer" }}>
        <X size={12} />
      </button>
    </div>
  );
}
