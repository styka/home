"use client";

import { useTranslations } from "next-intl";
import { Bookmark, BookmarkCheck, ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/news/format";
import type { NewsItemDTO } from "../actions/news";

/**
 * 125: jeden wiersz widoku samych tytułów — narzędzie TRIAGE'U, nie lektury.
 *
 * Zgłoszenie właściciela do 124: decyzja „czy tytuł mi wystarczy" ma zapadać na liście samych
 * tytułów, nie na rozwiniętych kartach. Dlatego CAŁY wiersz jest przyciskiem przełączającym
 * „doczytam" (największy możliwy cel dotyku przy przeglądzie kciukiem), a otwarcie artykułu to
 * OSOBNY, mniejszy element obok — przypadkowy klik w tytuł nie może wyrzucać z przeglądu do
 * przeglądarki. Gest jest odwracalny tym samym dotknięciem, stan widać natychmiast (optymistyka
 * w NewsPage), więc pomyłka kosztuje jedno dotknięcie i zero potwierdzeń.
 */
export function WierszTytulu({
  item,
  onPrzelacz,
}: {
  item: NewsItemDTO;
  onPrzelacz: (itemId: string, next: boolean) => void;
}) {
  const t = useTranslations("modules.news.WierszTytulu");

  return (
    <div data-news-wiersz={item.id} className="flex items-stretch gap-1">
      <button
        type="button"
        onClick={() => onPrzelacz(item.id, !item.readLater)}
        aria-pressed={item.readLater}
        title={item.readLater ? t("zdejmij") : t("oznacz")}
        className={cn(
          "flex min-w-0 flex-1 items-start gap-2.5 rounded-lg px-3 py-3 text-left transition-colors",
          item.readLater
            ? "bg-[var(--bg-elevated)] shadow-[inset_2px_0_0_var(--accent-amber)]"
            : "hover:bg-[var(--bg-hover)]"
        )}
      >
        {item.readLater ? (
          <BookmarkCheck size={16} className="mt-0.5 shrink-0 text-[var(--accent-amber)]" />
        ) : (
          <Bookmark size={16} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
        )}
        <span className="min-w-0">
          <span className="block min-w-0 [overflow-wrap:anywhere] font-medium leading-snug text-[var(--text-primary)]">
            {item.title}
          </span>
          <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
            {item.sourceName} · {timeAgo(item.publishedAt)}
          </span>
        </span>
      </button>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        title={t("otworzArtykul")}
        aria-label={t("otworzArtykul")}
        className="flex shrink-0 items-center rounded-lg px-2.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      >
        <ExternalLink size={15} />
      </a>
    </div>
  );
}
