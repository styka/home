"use client";

import { useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ImagePlus, Loader2, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (url: string) => void;
  /** Which module folder the upload should land in on the user's Drive. */
  module: string;
  placeholder?: string;
  inputStyle?: CSSProperties;
  inputClassName?: string;
}

// Image field that accepts either a pasted internet URL (original behaviour) or
// a direct upload to the user's connected Google Drive. The upload returns a
// proxy URL (/api/drive/file/<id>) which is stored in the same string field, so
// no per-module schema changes are needed.
export function ImageUrlInput({
  value,
  onChange,
  module,
  placeholder = "https://… (wklej link lub wgraj z Dysku)",
  inputStyle,
  inputClassName,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConnect, setNeedsConnect] = useState(false);

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setNeedsConnect(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("module", module);
      const res = await fetch("/api/drive/upload", { method: "POST", body: fd });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        if (res.status === 409) setNeedsConnect(true);
        else setError(data.error ?? "Nie udało się wgrać pliku");
        return;
      }
      if (data.url) onChange(data.url);
    } catch {
      setError("Nie udało się wgrać pliku");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClassName}
          style={{ flex: 1, ...inputStyle }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Wgraj zdjęcie na swój Dysk Google"
          style={{
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            fontSize: 13,
            cursor: uploading ? "default" : "pointer",
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          Wgraj
        </button>
      </div>

      {value ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover", border: "1px solid var(--border)" }}
          />
          <button
            type="button"
            onClick={() => onChange("")}
            title="Usuń zdjęcie"
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}
          >
            <X size={13} /> Usuń
          </button>
        </div>
      ) : null}

      {needsConnect ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
          Aby wgrywać pliki, najpierw{" "}
          <Link href="/settings" style={{ color: "var(--accent-blue)" }}>
            połącz Dysk Google
          </Link>{" "}
          w Ustawieniach.
        </p>
      ) : null}
      {error ? (
        <p style={{ fontSize: 12, color: "var(--accent-red)", margin: 0 }}>{error}</p>
      ) : null}
    </div>
  );
}
