import path from "path"
import fs from "fs"

export interface AudytChapter {
  slug: string
  title: string
  order: number
  icon?: string
  filePath: string
  estimatedReadTime?: number
}

export const AUDYT_CHAPTERS: AudytChapter[] = [
  {
    slug: "opis-projektu",
    title: "1. Opis projektu — funkcjonalny i techniczny",
    order: 1,
    filePath: "01-opis-projektu.html",
    estimatedReadTime: 8,
  },
  {
    slug: "analizy-podstawowe",
    title: "2. Analizy podstawowe: UX, baza danych, skalowanie",
    order: 2,
    filePath: "02-analizy-podstawowe.html",
    estimatedReadTime: 12,
  },
  {
    slug: "analizy-zaawansowane",
    title: "3. Analizy zaawansowane: bezpieczeństwo, performance, konkurencja",
    order: 3,
    filePath: "03-analizy-zaawansowane.html",
    estimatedReadTime: 15,
  },
  {
    slug: "debaty-zespolow",
    title: "4. Debaty dwóch zespołów: perfekcjoniści vs fantazja",
    order: 4,
    filePath: "04-debaty-zespolow.html",
    estimatedReadTime: 25,
  },
  {
    slug: "marketing",
    title: "5. Marketing: GTM, budżet, growth loops",
    order: 5,
    filePath: "05-marketing.html",
    estimatedReadTime: 10,
  },
  {
    slug: "dodatek-zalecenia",
    title: "6. Dodatek: Zalecenia i Plany Wdrażania",
    order: 6,
    filePath: "06-dodatek-zalecenia.html",
    estimatedReadTime: 30,
  },
  {
    slug: "podsumowanie",
    title: "7. Podsumowanie zespołów: wnioski i kolejne 6 miesięcy",
    order: 7,
    filePath: "07-podsumowanie.html",
    estimatedReadTime: 10,
  },
]

/**
 * Wczytuje zawartość rozdziału z dysku.
 * Użyj tylko na Server Components.
 */
export async function loadAudytChapter(slug: string): Promise<string> {
  const chapter = AUDYT_CHAPTERS.find((c) => c.slug === slug)
  if (!chapter) {
    throw new Error(`Audyt chapter not found: ${slug}`)
  }

  const chapterPath = path.join(
    process.cwd(),
    "content",
    "audyt-2026-06-14",
    chapter.filePath
  )

  try {
    const content = fs.readFileSync(chapterPath, "utf8")
    return content
  } catch (error) {
    console.error(`Failed to load audyt chapter ${slug}:`, error)
    throw error
  }
}

/**
 * Pobiera metadane wszystkich rozdziałów.
 */
export function getAudytChapters(): AudytChapter[] {
  return AUDYT_CHAPTERS
}

/**
 * Pobiera pojedynczy rozdział po slug.
 */
export function getAudytChapter(slug: string): AudytChapter | undefined {
  return AUDYT_CHAPTERS.find((c) => c.slug === slug)
}
