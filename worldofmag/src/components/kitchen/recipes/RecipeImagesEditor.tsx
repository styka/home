"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2, ScanText, Loader2, FileText } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { runJob } from "@/lib/jobs/client";
import { addRecipeImage, updateRecipeImage, deleteRecipeImage } from "@/actions/recipes";
import { fileToDownscaledDataUrl } from "@/lib/image-utils";
import type { RecipeImage } from "@/types/kitchen";

interface RecipeImagesEditorProps {
  recipeId: string;
  images: RecipeImage[];
  hasAI?: boolean;
}

export function RecipeImagesEditor({ recipeId, images, hasAI }: RecipeImagesEditorProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<RecipeImage[]>(images);
  const [uploading, setUploading] = useState(false);
  const [ocrBusyId, setOcrBusyId] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    let added = 0;
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const dataUrl = await fileToDownscaledDataUrl(file);
        const created = await addRecipeImage(recipeId, { url: dataUrl });
        setItems((prev) => [...prev, created]);
        added += 1;
      }
      if (added > 0) showToast(`Dodano ${added} ${added === 1 ? "zdjęcie" : "zdjęcia"}`, "success");
      else showToast("Nie wybrano zdjęć", "info");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Błąd dodawania zdjęcia", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleCaptionBlur(id: string, value: string) {
    const item = items.find((i) => i.id === id);
    if (!item || (item.caption ?? "") === value) return;
    try {
      const updated = await updateRecipeImage(id, { caption: value });
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Błąd zapisu podpisu", "error");
    }
  }

  async function handleOcr(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setOcrBusyId(id);
    try {
      // Z-131 (T-17): OCR przez kolejkę (bez timeoutów żądania). Błędy rzuca → catch niżej.
      const res = await runJob<{ hasText: boolean; markdown: string }>("kitchen.ocrText", { image: item.url });
      const markdown = res.hasText && res.markdown ? res.markdown : "";
      const updated = await updateRecipeImage(id, { ocrMarkdown: markdown });
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      showToast(markdown ? "Odczytano tekst ze zdjęcia" : "Na zdjęciu nie znaleziono tekstu", markdown ? "success" : "info");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Błąd OCR", "error");
    } finally {
      setOcrBusyId(null);
    }
  }

  async function handleOcrEdit(id: string, value: string) {
    const item = items.find((i) => i.id === id);
    if (!item || (item.ocrMarkdown ?? "") === value) return;
    try {
      const updated = await updateRecipeImage(id, { ocrMarkdown: value });
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Błąd zapisu tekstu", "error");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Usunąć to zdjęcie?")) return;
    try {
      await deleteRecipeImage(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Błąd usuwania", "error");
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Zdjęcia i załączniki
        </h2>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded disabled:opacity-50"
          style={{ color: "var(--accent-orange)" }}
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
          {uploading ? "Wgrywam…" : "Dodaj zdjęcia"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
        Dodaj zdjęcia kartek z przepisem. {hasAI ? "Dla każdego zdjęcia możesz odczytać tekst (OCR) — pojawi się obok zdjęcia jako edytowalny Markdown." : "Odczyt tekstu (OCR) wymaga skonfigurowanego AI."}
      </p>

      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Brak zdjęć.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((img, idx) => (
            <div
              key={img.id}
              className="flex flex-col md:flex-row gap-3 p-2 rounded border"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
            >
              <div className="md:w-44 flex-shrink-0 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Zdjęcie {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(img.id)}
                    aria-label="Usuń zdjęcie"
                    style={{ color: "var(--accent-red)" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.caption ?? `Zdjęcie ${idx + 1}`}
                  className="w-full rounded border"
                  style={{ aspectRatio: "4 / 3", objectFit: "cover", borderColor: "var(--border)" }}
                />
                <input
                  type="text"
                  defaultValue={img.caption ?? ""}
                  onBlur={(e) => handleCaptionBlur(img.id, e.target.value)}
                  placeholder="Podpis (opcjonalny)"
                  className="w-full px-2 py-1 rounded border text-xs"
                  style={inputStyle}
                />
                {hasAI ? (
                  <button
                    type="button"
                    onClick={() => handleOcr(img.id)}
                    disabled={ocrBusyId === img.id}
                    className="inline-flex items-center justify-center gap-1 text-xs px-2 py-1 rounded disabled:opacity-50"
                    style={{ border: "1px solid var(--accent-purple)", color: "var(--accent-purple)" }}
                  >
                    {ocrBusyId === img.id ? <Loader2 size={12} className="animate-spin" /> : <ScanText size={12} />}
                    {ocrBusyId === img.id ? "Odczytuję…" : img.ocrMarkdown ? "Odczytaj ponownie" : "Odczytaj tekst (OCR)"}
                  </button>
                ) : null}
              </div>

              <div className="flex-1 min-w-0">
                {img.ocrMarkdown != null && img.ocrMarkdown !== "" ? (
                  <label className="flex flex-col gap-1">
                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      <FileText size={11} /> Tekst odczytany ze zdjęcia {idx + 1} (Markdown, edytowalny)
                    </span>
                    <textarea
                      defaultValue={img.ocrMarkdown}
                      onBlur={(e) => handleOcrEdit(img.id, e.target.value)}
                      rows={8}
                      className="w-full px-2 py-1.5 rounded border text-xs font-mono resize-y"
                      style={inputStyle}
                    />
                  </label>
                ) : img.ocrMarkdown === "" ? (
                  <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                    Na tym zdjęciu nie znaleziono tekstu.
                  </p>
                ) : (
                  <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                    Tekst jeszcze nie odczytany.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-elevated)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};
