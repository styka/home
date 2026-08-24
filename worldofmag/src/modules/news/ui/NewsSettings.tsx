"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, Library } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { SourceCatalogPicker } from "./SourceCatalogPicker";
import { NaglowekSekcji } from "./sekcjeTematow";
import {
  createSource,
  updateSource,
  deleteSource,
  type SourceDTO,
} from "../actions/news";

export function NewsSettings({
  sources,
  onChanged,
}: {
  sources: SourceDTO[];
  onChanged: () => void;
}) {
  const t = useTranslations("modules.news.NewsSettings");
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  // 082: przeglądarka systemowej biblioteki źródeł — druga, domyślna droga dodania.
  const [showCatalog, setShowCatalog] = useState(false);
  const [name, setName] = useState("");
  const [rssUrl, setRssUrl] = useState("");
  const [homepageUrl, setHomepageUrl] = useState("");
  const [descriptor, setDescriptor] = useState("");

  function run(fn: () => Promise<void>, ok?: string) {
    startTransition(async () => {
      try {
        await fn();
        if (ok) showToast(ok, "success");
        onChanged();
      } catch (e: any) {
        showToast(e.message ?? "Błąd", "error");
      }
    });
  }

  function add() {
    if (!name.trim() || !rssUrl.trim()) {
      showToast("Podaj nazwę i adres RSS", "error");
      return;
    }
    run(async () => {
      await createSource({ name, rssUrl, homepageUrl, descriptor });
      setShowAdd(false);
      setName("");
      setRssUrl("");
      setHomepageUrl("");
      setDescriptor("");
    }, "Dodano źródło");
  }

  /**
   * 083 (AC-26..AC-28): zakładka Źródeł przestała być „krzywa".
   *
   * 085 (AC-17): ustawienie długości streszczeń WYSZŁO stąd do zakładki ustawień modułu — nie jest
   * cechą żadnego kanału, więc w liście źródeł było gościem. Punkt 1 poniżej opisuje więc stan
   * historyczny; zostaje, bo tłumaczy, czemu w ogóle tu stało.
   *
   *  1. **Wiersz ma STAŁĄ strukturę.** Poprzednia wersja stawiała nazwę, opis, adres i kosz obok
   *     siebie w zawijanym `flex`, więc szerokość każdej kolumny zależała od DŁUGOŚCI NAZWY danego
   *     kanału — pola opisu zaczynały się w innym miejscu w każdym wierszu i to właśnie wyglądało
   *     na krzywe. Siatka o zadanych kolumnach ustawia je w jednej osi niezależnie od treści.
   *  3. **Ten sam przyklejony nagłówek sekcji, co w pozostałych zakładkach** (`NaglowekSekcji`) —
   *     spójność, o którą właściciel prosił wprost, wynika ze wspólnego komponentu, a nie z
   *     przepisanego na nowo, podobnego kawałka JSX.
   */
  return (
    <div className="space-y-6">
      <section>
        <NaglowekSekcji
          tytul={t("zrodlaWiadomosci")}
          licznik={sources.length}
          akcje={
            !showAdd ? (
              /* 082: dwie drogi obok siebie. Biblioteka jest wariantem podstawowym, bo dla
                 większości kanałów jest po prostu szybsza; ręczne wpisanie adresu zostaje dla
                 tego, czego w bibliotece nie ma. Obie stoją w nagłówku sekcji, a nie pod listą —
                 dzięki temu nie odjeżdżają w dół razem z nią. */
              <div className="flex shrink-0 items-center gap-1">
                <Button size="sm" onClick={() => setShowCatalog(true)}>
                  <Library size={14} /> {t("dodajZBiblioteki")}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
                  <Plus size={14} /> {t("dodajRecznie")}
                </Button>
              </div>
            ) : undefined
          }
        />

        {showAdd && (
          <div className="mt-3 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("nazwaZrodlaNpTvn24")}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
            <input
              value={rssUrl}
              onChange={(e) => setRssUrl(e.target.value)}
              placeholder="Adres RSS (https://…/rss)"
              className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
            <input
              value={homepageUrl}
              onChange={(e) => setHomepageUrl(e.target.value)}
              placeholder="Adres strony (opcjonalnie)"
              className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
            <div className="flex items-center gap-2">
              <input
                value={descriptor}
                onChange={(e) => setDescriptor(e.target.value)}
                maxLength={60}
                placeholder="Opis (np. pop-science)"
                className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
              <Button size="sm" onClick={add}>
                Dodaj
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                Anuluj
              </Button>
            </div>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {sources.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
              {t("brakZrodel")}
            </p>
          ) : (
            sources.map((s) => (
              <div
                key={s.id}
                /* Siatka, nie zawijany `flex`: kolumny mają stałe udziały, więc pole opisu zaczyna
                   się w każdym wierszu w tym samym miejscu. Na telefonie jedna kolumna — cztery
                   ściśnięte kolumny na 360 px byłyby gorsze niż cztery wiersze. */
                className="grid grid-cols-1 items-center gap-x-3 gap-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3 md:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1.1fr)_auto]"
              >
                <label className="flex min-w-0 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={() => run(() => updateSource(s.id, { enabled: !s.enabled }))}
                    className="h-5 w-5 shrink-0 accent-[var(--accent-blue)]"
                  />
                  <span className="min-w-0 truncate font-medium text-[var(--text-primary)]">{s.name}</span>
                </label>

                {/* 040: dowolny opis zamiast wyboru z trzech kategorii — zestaw kanałów dawno
                    wyszedł poza politykę. Zapis na `blur`, żeby nie strzelać akcją przy każdej
                    wpisanej literze. */}
                <SourceDescriptorInput
                  value={s.descriptor}
                  onSave={(next) => run(() => updateSource(s.id, { descriptor: next }))}
                />

                {/* 040: `min-w-0` jest tu WARUNKIEM działania `truncate`, nie ozdobą. Element siatki
                    ma domyślnie `min-width: auto`, więc nie potrafi zwęzić się poniżej swojej
                    treści — długi adres RSS rozpychał wiersz, a przez niego całą stronę (poziomy
                    scroll na telefonie). */}
                <span className="min-w-0 truncate text-xs text-[var(--text-muted)]" title={s.rssUrl}>
                  {s.rssUrl}
                </span>

                <button
                  onClick={() => run(() => deleteSource(s.id), "Usunięto źródło")}
                  className="justify-self-start rounded-md p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--accent-red)] md:justify-self-end"
                  title={t("usunZrodlo")}
                  aria-label={`Usuń źródło: ${s.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        {showCatalog && <SourceCatalogPicker onClose={() => setShowCatalog(false)} onAdded={onChanged} />}
      </section>
    </div>
  );
}

/**
 * 040: pole opisu źródła zapisywane na `blur` (albo Enterem), nie przy każdej literze.
 *
 * Zapis „na zmianę" wysyłałby Server Action po każdym znaku, a przy okazji `revalidatePath` —
 * czyli kilkadziesiąt round-tripów na jeden wpisany opis. Trzymamy więc wartość lokalnie i
 * zapisujemy dopiero, gdy użytkownik skończy pisać i faktycznie coś zmienił.
 */
function SourceDescriptorInput({
  value,
  onSave,
}: {
  value: string;
  onSave: (next: string) => void;
}) {
  const t = useTranslations("modules.news.NewsSettings");
  const [draft, setDraft] = useState(value);

  // Wartość z serwera wygrywa, gdy zmieni się poza tym polem (np. po odświeżeniu listy).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    const next = draft.trim();
    if (next === value.trim()) return;
    onSave(next);
  }

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(value);
      }}
      maxLength={60}
      placeholder={t("opisZrodla")}
      aria-label={t("opisZrodla")}
      // Szerokość należy do KOLUMNY siatki, nie do pola — inaczej pole i kolumna kłóciłyby się
      // o rozmiar i wiersz znów wyglądałby krzywo.
      className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-2 text-xs text-[var(--text-primary)]"
    />
  );
}
