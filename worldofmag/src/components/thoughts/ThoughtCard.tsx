"use client";

import { useState, useTransition } from "react";
import { Trash2, Paperclip, X, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { deleteThought } from "@/actions/thoughts";
import type { ThoughtWithAttachments } from "@/types";

function formatDate(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const time = d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  if (days === 0) return `Dziś, ${time}`;
  if (days === 1) return `Wczoraj, ${time}`;
  if (days < 7) return d.toLocaleDateString("pl-PL", { weekday: "long" }) + `, ${time}`;
  return (
    d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" }) +
    `, ${time}`
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function driveViewUrl(fileId: string) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

interface ThoughtCardProps {
  thought: ThoughtWithAttachments;
}

export function ThoughtCard({ thought }: ThoughtCardProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();

  const images = thought.attachments.filter((a) => a.type === "image");
  const files = thought.attachments.filter((a) => a.type === "file");
  const TRUNCATE = 400;
  const isLong = thought.content.length > TRUNCATE;
  const displayContent =
    isLong && !expanded ? thought.content.slice(0, TRUNCATE) + "…" : thought.content;

  const imgGridCols =
    images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-3";

  function handleDelete() {
    startTransition(async () => {
      await deleteThought(thought.id);
    });
  }

  return (
    <>
      <article className="border-b px-4 py-4" style={{ borderColor: "var(--border)" }}>
        {/* Timestamp */}
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          {formatDate(thought.createdAt)}
        </p>

        {/* Text */}
        {thought.content && (
          <div className="mb-3">
            <p
              className="text-sm whitespace-pre-wrap leading-relaxed"
              style={{ color: "var(--text-primary)" }}
            >
              {displayContent}
            </p>
            {isLong && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs mt-1.5"
                style={{ color: "var(--accent-purple)" }}
              >
                {expanded ? (
                  <><ChevronUp size={12} /> Pokaż mniej</>
                ) : (
                  <><ChevronDown size={12} /> Pokaż więcej</>
                )}
              </button>
            )}
          </div>
        )}

        {/* Image grid */}
        {images.length > 0 && (
          <div>
            <div className={`grid gap-1.5 ${imgGridCols}`}>
              {images.map((img) => (
                <img
                  key={img.id}
                  src={img.url}
                  alt={img.filename}
                  loading="lazy"
                  className="w-full rounded cursor-pointer object-cover"
                  style={{
                    maxHeight: images.length === 1 ? "480px" : "140px",
                    border: "1px solid var(--border)",
                  }}
                  onClick={() => setLightboxUrl(img.url)}
                />
              ))}
            </div>
            {/* Drive links for images */}
            {images.some((img) => img.driveFileId) && (
              <div className="flex flex-wrap gap-2 mt-1.5">
                {images.map((img) =>
                  img.driveFileId ? (
                    <a
                      key={img.id}
                      href={driveViewUrl(img.driveFileId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs"
                      style={{ color: "var(--text-muted)" }}
                      title="Otwórz w Google Drive"
                    >
                      <ExternalLink size={11} />
                      {images.length > 1 ? img.filename : "Otwórz w Google Drive"}
                    </a>
                  ) : null
                )}
              </div>
            )}
          </div>
        )}

        {/* File attachments */}
        {files.length > 0 && (
          <div className="flex flex-col gap-1 mt-2">
            {files.map((file) => {
              const href = file.driveFileId
                ? driveViewUrl(file.driveFileId)
                : file.url;
              return (
                <a
                  key={file.id}
                  href={href}
                  target={file.driveFileId ? "_blank" : undefined}
                  download={file.driveFileId ? undefined : file.filename}
                  rel={file.driveFileId ? "noopener noreferrer" : undefined}
                  className="flex items-center gap-2 px-3 py-2 rounded text-sm"
                  style={{
                    backgroundColor: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <Paperclip size={13} style={{ flexShrink: 0 }} />
                  <span className="truncate flex-1">{file.filename}</span>
                  <span className="flex items-center gap-1 flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                    {file.size != null && (
                      <span className="text-xs">{formatSize(file.size)}</span>
                    )}
                    {file.driveFileId && <ExternalLink size={11} />}
                  </span>
                </a>
              );
            })}
          </div>
        )}

        {/* Delete */}
        <div className="flex justify-end mt-3">
          <button
            onClick={handleDelete}
            title="Usuń myśl"
            className="p-1.5 rounded"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--accent-red)";
              e.currentTarget.style.backgroundColor = "var(--bg-elevated)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.backgroundColor = "";
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </article>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff" }}
            onClick={() => setLightboxUrl(null)}
          >
            <X size={20} />
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
