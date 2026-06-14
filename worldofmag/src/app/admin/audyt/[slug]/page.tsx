import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { loadAudytChapter, getAudytChapters, getAudytChapter } from "@/lib/audyt"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface Props {
  params: { slug: string }
}

export default async function AudytChapterPage({ params }: Props) {
  const session = await auth()
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/")

  const chapter = getAudytChapter(params.slug)
  if (!chapter) notFound()

  let content: string
  try {
    content = await loadAudytChapter(params.slug)
  } catch (error) {
    console.error(`Failed to load chapter ${params.slug}:`, error)
    notFound()
  }

  const chapters = getAudytChapters()
  const currentIndex = chapters.findIndex((c) => c.slug === params.slug)
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Back link */}
        <Link
          href="/admin/audyt"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: "var(--text-muted)",
            textDecoration: "none",
            marginBottom: 20,
          }}
        >
          <ChevronLeft size={14} />
          Audyt
        </Link>

        {/* Chapter title */}
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 4,
            marginTop: 0,
          }}
        >
          {chapter.title}
        </h1>

        {chapter.estimatedReadTime && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 24, marginTop: 2 }}>
            Oczekiwany czas czytania: ~{chapter.estimatedReadTime} minut
          </p>
        )}

        {/* Content */}
        <div
          style={{
            color: "var(--text-primary)",
            lineHeight: 1.7,
          }}
          dangerouslySetInnerHTML={{ __html: content }}
        />

        {/* Navigation */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 48,
            paddingTop: 24,
            borderTop: "1px solid var(--border)",
          }}
        >
          {prevChapter ? (
            <Link
              href={`/admin/audyt/${prevChapter.slug}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flex: 1,
                padding: "12px 16px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                textDecoration: "none",
                fontSize: 13,
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)"
              }}
            >
              <ChevronLeft size={16} />
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Poprzedni</div>
                <div style={{ fontSize: 12 }}>{prevChapter.title}</div>
              </div>
            </Link>
          ) : (
            <div />
          )}

          {nextChapter ? (
            <Link
              href={`/admin/audyt/${nextChapter.slug}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 8,
                flex: 1,
                padding: "12px 16px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                textDecoration: "none",
                fontSize: 13,
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)"
              }}
            >
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Następny</div>
                <div style={{ fontSize: 12 }}>{nextChapter.title}</div>
              </div>
              <ChevronRight size={16} />
            </Link>
          ) : (
            <div />
          )}
        </div>

        {/* Progress */}
        <div
          style={{
            marginTop: 32,
            padding: "12px 16px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          Rozdział {currentIndex + 1} z {chapters.length}
        </div>
      </div>
    </div>
  )
}
