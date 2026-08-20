"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, Download, Loader2, Pencil, Plus, RefreshCw, Search, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { cn } from "@/lib/cn";
import {
  NEWS_CATALOG_CATEGORIES,
  NEWS_CATALOG_COUNTRIES,
  NEWS_CATALOG_LANGUAGES,
  etykietaKraju,
  etykietaJezyka,
  etykietaKategorii,
} from "@/lib/news/katalog";
import {
  getCatalogEntries,
  createCatalogEntry,
  updateCatalogEntry,
  setCatalogEntryEnabled,
  deleteCatalogEntry,
  checkCatalogEntry,
  exportCatalog,
  importCatalog,
  type AdminCatalogEntry,
} from "@/actions/adminNewsCatalog";

/**
 * 082 — zarządzanie systemową biblioteką źródeł RSS.
 *
 * Wzorzec przejęty z `SystemCategoryManager`: komponent kliencki dostaje pierwszą stronę danych
 * z serwera i dalej rozmawia z Server Actions.
 *
 * Dwie decyzje widoczne w interfejsie, obie z powodem:
 *  • **Wyłączenie stoi przed usunięciem.** Katalog liczy setki wpisów i część kanałów po prostu
 *    umrze; wyłączenie jest odwracalne i nie rusza źródeł, które ktoś z wpisu już dodał (dodanie
 *    KOPIUJE dane). Usunięcie zostaje, ale za potwierdzeniem, które mówi wprost, czego NIE robi.
 *  • **„Sprawdź" jest przy wpisie, nie zbiorczo.** Odpytanie czterystu kanałów naraz to kilka
 *    minut czekania i nagły ruch sieciowy w stronę cudzych serwerów; administrator sprawdza to,
 *    co właśnie podejrzewa.
 */
export function NewsSourceCatalogManager({ initial }: { initial: AdminCatalogEntry[] }) {
  const t = useTranslations("components.admin.NewsSourceCatalogManager");
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const [, startTransition] = useTransition();

  const [entries, setEntries] = useState<AdminCatalogEntry[]>(initial);
  const [ladowanie, setLadowanie] = useState(false);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const [category, setCategory] = useState("");
  const [stan, setStan] = useState<"" | "on" | "off">("");
  const [edytowany, setEdytowany] = useState<AdminCatalogEntry | null>(null);
  const [nowy, setNowy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const plikRef = useRef<HTMLInputElement>(null);
  const pierwszy = useRef(true);

  const load = useCallback(async () => {
    setLadowanie(true);
    try {
      setEntries(
        await getCatalogEntries({
          q: query || undefined,
          country: country || undefined,
          language: language || undefined,
          category: category || undefined,
          onlyDisabled: stan === "" ? undefined : stan === "off",
        }),
      );
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setLadowanie(false);
    }
  }, [query, country, language, category, stan, showToast]);

  // Pierwsze dane przychodzą z serwera — bez tej wartowniczej flagi komponent odpytywałby je
  // drugi raz zaraz po zamontowaniu, tylko po to, żeby dostać dokładnie to samo.
  useEffect(() => {
    if (pierwszy.current) {
      pierwszy.current = false;
      return;
    }
    const id = setTimeout(() => void load(), 250);
    return () => clearTimeout(id);
  }, [load]);

  function dzialanie(fn: () => Promise<void>, ok?: string) {
    startTransition(async () => {
      try {
        await fn();
        if (ok) showToast(ok, "success");
        await load();
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : String(e), "error");
      }
    });
  }

  async function sprawdz(e: AdminCatalogEntry) {
    setBusyId(e.id);
    try {
      const wynik = await checkCatalogEntry(e.id);
      showToast(wynik.note, wynik.status === "ok" ? "success" : "error");
      await load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function eksportuj() {
    try {
      const paczka = await exportCatalog();
      const blob = new Blob([JSON.stringify(paczka, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `omnia-biblioteka-zrodel-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  }

  async function importuj(plik: File) {
    try {
      const wynik = await importCatalog(await plik.text());
      showToast(t("importGotowy", { added: wynik.added, skipped: wynik.skipped }), "success");
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  }

  async function usun(e: AdminCatalogEntry) {
    if (!(await confirmDialog(t("potwierdzUsuniecie", { nazwa: e.name })))) return;
    dzialanie(() => deleteCatalogEntry(e.id));
  }

  const selectClass =
    "min-w-0 rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-2 text-sm text-[var(--text-primary)]";
  const ikona =
    "rounded p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-40";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setNowy(true)}>
          <Plus size={14} /> {t("dodajWpis")}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void eksportuj()}>
          <Download size={14} /> {t("eksport")}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => plikRef.current?.click()}>
          <Upload size={14} /> {t("importuj")}
        </Button>
        <input
          ref={plikRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            // Czyścimy wartość, żeby ten sam plik dało się wgrać drugi raz — bez tego `change`
            // nie zajdzie, bo wartość pola się nie zmieni.
            e.target.value = "";
            if (f) void importuj(f);
          }}
        />
        <span className="ml-auto text-xs text-[var(--text-muted)]">
          {t("liczbaWpisow", { ile: entries.length })}
        </span>
      </div>

      <div className="flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
        <Search size={15} className="shrink-0 text-[var(--text-muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("szukaj")}
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
        />
        {ladowanie && <Loader2 size={14} className="shrink-0 animate-spin text-[var(--text-muted)]" />}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <select value={country} onChange={(e) => setCountry(e.target.value)} className={selectClass}>
          <option value="">{t("wszystkieKraje")}</option>
          {NEWS_CATALOG_COUNTRIES.map((c) => (
            <option key={c.key || "intl"} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className={selectClass}>
          <option value="">{t("wszystkieJezyki")}</option>
          {NEWS_CATALOG_LANGUAGES.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
          <option value="">{t("wszystkieKategorie")}</option>
          {NEWS_CATALOG_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={stan}
          onChange={(e) => setStan(e.target.value as "" | "on" | "off")}
          className={selectClass}
        >
          <option value="">{t("wszystkieWpisy")}</option>
          <option value="on">{t("tylkoWlaczone")}</option>
          <option value="off">{t("tylkoWylaczone")}</option>
        </select>
      </div>

      <div className="space-y-1.5">
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t("nicNieZnaleziono")}</p>
        ) : (
          entries.map((e) => (
            <div
              key={e.id}
              className={cn(
                "flex flex-wrap items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3",
                !e.enabled && "opacity-60",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-words text-sm font-medium text-[var(--text-primary)]">{e.name}</span>
                  <code className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                    {e.key}
                  </code>
                  {!e.enabled && (
                    <span className="rounded border border-[var(--text-muted)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                      {t("wylaczonyWpis")}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 break-all text-[11px] text-[var(--text-muted)]">{e.rssUrl}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                  {e.descriptor && (
                    <span className="rounded border border-[var(--border)] px-1.5 py-0.5">{e.descriptor}</span>
                  )}
                  <span>{e.country ? etykietaKraju(e.country) : t("bezKraju")}</span>
                  <span>·</span>
                  <span>{etykietaJezyka(e.language)}</span>
                  <span>·</span>
                  <span>{etykietaKategorii(e.category)}</span>
                  <span>·</span>
                  {/* Wynik sprawdzenia mówi WPROST, że go nie było — „nieznany" bez tej informacji
                      czyta się jak „sprawdzony i niepewny". */}
                  <span
                    style={{
                      color:
                        e.checkStatus === "ok"
                          ? "var(--accent-green)"
                          : e.checkStatus === "error"
                            ? "var(--accent-red)"
                            : "var(--text-muted)",
                    }}
                  >
                    {e.checkStatus === "unknown" ? t("nigdyNieSprawdzany") : e.checkNote}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => dzialanie(() => setCatalogEntryEnabled(e.id, !e.enabled))}
                  className={ikona}
                  title={e.enabled ? t("wylacz") : t("wlacz")}
                  aria-label={e.enabled ? t("wylacz") : t("wlacz")}
                >
                  {e.enabled ? <X size={14} /> : <Check size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => void sprawdz(e)}
                  disabled={busyId === e.id}
                  className={ikona}
                  title={t("sprawdz")}
                  aria-label={t("sprawdz")}
                >
                  <RefreshCw size={14} className={busyId === e.id ? "animate-spin" : ""} />
                </button>
                <button
                  type="button"
                  onClick={() => setEdytowany(e)}
                  className={ikona}
                  title={t("edytuj")}
                  aria-label={t("edytuj")}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => void usun(e)}
                  className={cn(ikona, "hover:text-[var(--accent-red)]")}
                  title={t("usun")}
                  aria-label={t("usun")}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {(nowy || edytowany) && (
        <FormularzWpisu
          wpis={edytowany}
          onClose={() => {
            setNowy(false);
            setEdytowany(null);
          }}
          onSaved={() => {
            setNowy(false);
            setEdytowany(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function FormularzWpisu({
  wpis,
  onClose,
  onSaved,
}: {
  wpis: AdminCatalogEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("components.admin.NewsSourceCatalogManager");
  const { showToast } = useToast();
  const [, startTransition] = useTransition();

  const [key, setKey] = useState(wpis?.key ?? "");
  const [name, setName] = useState(wpis?.name ?? "");
  const [rssUrl, setRssUrl] = useState(wpis?.rssUrl ?? "");
  const [homepageUrl, setHomepageUrl] = useState(wpis?.homepageUrl ?? "");
  const [descriptor, setDescriptor] = useState(wpis?.descriptor ?? "");
  const [country, setCountry] = useState(wpis?.country ?? "");
  const [language, setLanguage] = useState(wpis?.language ?? "pl");
  const [category, setCategory] = useState(wpis?.category ?? "wiadomosci");

  function zapisz() {
    startTransition(async () => {
      try {
        if (wpis) {
          // Klucz jest identyfikatorem naturalnym — wędruje do `NewsSource.key` u każdego, kto
          // wpis dodał. Zmiana rozspójniłaby „czy już mam to źródło", więc pola nie ma w edycji.
          await updateCatalogEntry(wpis.id, {
            name, rssUrl, homepageUrl, descriptor, country, language, category,
          });
        } else {
          await createCatalogEntry({
            key, name, rssUrl, homepageUrl, descriptor, country, language, category,
          });
        }
        onSaved();
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : String(e), "error");
      }
    });
  }

  const input =
    "w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]";

  return (
    <Modal
      open
      onClose={onClose}
      title={wpis ? t("edycjaWpisu") : t("nowyWpis")}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("anuluj")}
          </Button>
          <Button size="sm" onClick={zapisz}>
            {t("zapisz")}
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        {!wpis && (
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder={t("klucz")} className={input} />
        )}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("nazwa")} className={input} />
        <input value={rssUrl} onChange={(e) => setRssUrl(e.target.value)} placeholder={t("adresKanalu")} className={input} />
        <input
          value={homepageUrl}
          onChange={(e) => setHomepageUrl(e.target.value)}
          placeholder={t("adresStrony")}
          className={input}
        />
        <input
          value={descriptor}
          onChange={(e) => setDescriptor(e.target.value)}
          maxLength={60}
          placeholder={t("opisZrodla")}
          className={input}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select value={country} onChange={(e) => setCountry(e.target.value)} className={input} aria-label={t("kraj")}>
            {NEWS_CATALOG_COUNTRIES.map((c) => (
              <option key={c.key || "intl"} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className={input} aria-label={t("jezyk")}>
            {NEWS_CATALOG_LANGUAGES.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={input} aria-label={t("kategoria")}>
            {NEWS_CATALOG_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
