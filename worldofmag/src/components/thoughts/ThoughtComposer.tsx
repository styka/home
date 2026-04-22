"use client";

import { useState, useRef, useTransition } from "react";
import { Camera, ImageIcon, Paperclip, Send, X, Loader2 } from "lucide-react";
import { createThought } from "@/actions/thoughts";

interface PendingAttachment {
  dataUrl: string;
  filename: string;
  mimeType: string;
  size: number;
  type: "image" | "file";
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Read failed"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image load failed"));
      img.onload = () => {
        const MAX = 1200;
        let w = img.width;
        let h = img.height;
        if (w > MAX || h > MAX) {
          if (w >= h) { h = Math.round((h * MAX) / w); w = MAX; }
          else { w = Math.round((w * MAX) / h); h = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

async function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Read failed"));
    reader.onload = (e) => resolve(e.target!.result as string);
    reader.readAsDataURL(file);
  });
}

export function ThoughtComposer() {
  const [content, setContent] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [, startTransition] = useTransition();
  const cameraRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isBusy = isUploading;
  const canSubmit = (content.trim().length > 0 || pending.length > 0) && !isBusy;

  async function handleImageFiles(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await compressImage(file);
        setPending((prev) => [
          ...prev,
          { dataUrl, filename: file.name, mimeType: "image/jpeg", size: file.size, type: "image" },
        ]);
      } catch {
        // skip
      }
    }
    if (cameraRef.current) cameraRef.current.value = "";
    if (photoRef.current) photoRef.current.value = "";
  }

  async function handleFileAttachments(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await readAsDataUrl(file);
        setPending((prev) => [
          ...prev,
          { dataUrl, filename: file.name, mimeType: file.type, size: file.size, type: "file" },
        ]);
      } catch {
        // skip
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsUploading(true);
    try {
      const attachments = await Promise.all(
        pending.map(async (att) => {
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dataUrl: att.dataUrl,
              filename: att.filename,
              mimeType: att.mimeType,
              size: att.size,
            }),
          });
          const data = await res.json();
          return { type: att.type, url: data.url, filename: att.filename, mimeType: att.mimeType, size: att.size };
        })
      );
      const savedContent = content;
      setContent("");
      setPending([]);
      startTransition(async () => {
        await createThought(savedContent, attachments);
      });
    } finally {
      setIsUploading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div
      className="border-b flex-shrink-0 p-3"
      style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Co myślisz… (Ctrl+Enter aby zapisać)"
        rows={3}
        className="w-full rounded text-sm resize-none focus:outline-none p-3 border"
        style={{
          backgroundColor: "var(--bg-base)",
          color: "var(--text-primary)",
          borderColor: "var(--border)",
          lineHeight: "1.6",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--border-focus)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      />

      {/* Pending attachment previews */}
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {pending.map((att, i) => (
            <div key={i} className="relative">
              {att.type === "image" ? (
                <img
                  src={att.dataUrl}
                  alt={att.filename}
                  className="h-20 w-20 object-cover rounded"
                  style={{ border: "1px solid var(--border)" }}
                />
              ) : (
                <div
                  className="h-20 w-20 flex flex-col items-center justify-center rounded gap-1 p-1"
                  style={{
                    backgroundColor: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <Paperclip size={16} />
                  <span className="text-xs truncate w-full text-center leading-tight">
                    {att.filename.split(".").pop()?.toUpperCase() ?? "FILE"}
                  </span>
                </div>
              )}
              <button
                onClick={() => setPending((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-0.5">
          {/* Hidden inputs */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleImageFiles(e.target.files)}
          />
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleImageFiles(e.target.files)}
          />
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileAttachments(e.target.files)}
          />

          <IconButton title="Zrób zdjęcie" onClick={() => cameraRef.current?.click()}>
            <Camera size={16} />
          </IconButton>
          <IconButton title="Dodaj zdjęcie z galerii" onClick={() => photoRef.current?.click()}>
            <ImageIcon size={16} />
          </IconButton>
          <IconButton title="Dodaj załącznik" onClick={() => fileRef.current?.click()}>
            <Paperclip size={16} />
          </IconButton>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium"
          style={{
            backgroundColor: canSubmit ? "var(--accent-purple)" : "var(--bg-elevated)",
            color: canSubmit ? "#fff" : "var(--text-muted)",
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {isBusy ? "Zapisuję…" : "Zapisz"}
        </button>
      </div>
    </div>
  );
}

function IconButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="p-2 rounded"
      style={{ color: "var(--text-secondary)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--bg-hover)";
        e.currentTarget.style.color = "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "";
        e.currentTarget.style.color = "var(--text-secondary)";
      }}
    >
      {children}
    </button>
  );
}
