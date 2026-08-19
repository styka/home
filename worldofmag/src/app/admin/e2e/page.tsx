import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import {
  MousePointerClick,
  ChevronLeft,
  Rocket,
  Terminal,
  Cog,
  Server,
  ShieldCheck,
  ListChecks,
  AlertTriangle,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function E2EGuidePage() {
  const t = await getTranslations("app.admin.e2e.page");
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <Link
          href="/admin"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 20 }}
        >
          <ChevronLeft size={14} />
          Admin
        </Link>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <MousePointerClick size={20} style={{ color: "var(--accent-red)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            {t("testyKlikaczeE2eJak")}
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 32, marginTop: 4 }}>
          Automatyczne testy w przeglądarce (Playwright) odtwarzające scenariusze QA z modułu{" "}
          <Link href="/qa" style={{ color: "var(--accent-red)" }}>/qa</Link>{t("klikajaAplikacjeJakZywy")} <Code>worldofmag/e2e/</Code>, pełne README:{" "}
          <Code>worldofmag/e2e/README.md</Code>.
        </p>

        {/* Szybki start */}
        <Section title="Szybki start — jedna komenda" icon={<Rocket size={15} />}>
          <p style={paraStyle}>
            {t("najprostszaDrogaTestyOdpalaja")} <strong>Twoim localhost</strong> {t("zJednorazowaLokalnaBaza")} <Code>worldofmag/</Code>:
          </p>
          <CodeBlock code={`# 1) jednorazowo
npm install
npm run test:e2e:install        # pobiera silnik Chromium

# 2) odpalenie (stawia bazę, migruje, pokazuje klikanie)
npm run test:e2e:local

# 3) sprzątanie bazy po pracy
npm run test:e2e:local:down`} />
          <Callout color="var(--accent-green)" icon={<Smartphone size={14} />}>
            Tryb demo jest <strong>headed + zwolniony</strong> {t("widacKazdeKlikniecieSeria")}
          </Callout>
          <p style={paraStyle}>
            Wymagany jest tylko <strong>Docker</strong> (darmowy): macOS najprościej{" "}
            <em>Docker Desktop</em>{t("alboWPelniWolny")} <em>Colima</em>
            (<Code>brew install colima docker docker-compose &amp;&amp; colima start</Code>).
          </p>
        </Section>

        {/* Tryby */}
        <Section title="Tryby uruchamiania" icon={<Terminal size={15} />}>
          <InfoGrid
            rows={[
              { label: "npm run test:e2e:local", value: "Wszystko naraz: baza Docker + migracje + demo (desktop i mobile)." },
              { label: "npm run test:e2e:local:down", value: "Zatrzymuje i kasuje lokalną bazę testową." },
              { label: "npm run test:e2e", value: "Demo headed na gotowej bazie (gdy masz własny DATABASE_URL w .env.local)." },
              { label: "npm run test:e2e:desktop", value: "Tylko przeglądarka desktopowa." },
              { label: "npm run test:e2e:mobile", value: "Tylko iPhone 13 (mobile)." },
              { label: "npm run test:e2e:ui", value: "Interaktywny tryb UI Playwrighta (krok po kroku)." },
              { label: "npm run test:e2e:ci", value: "Headless, równolegle — do CI/automatyzacji." },
              { label: "npm run test:e2e:report", value: "Otwiera raport HTML z ostatniego biegu." },
            ]}
          />
        </Section>

        {/* Relacja do produkcji */}
        <Section title={t("aProdukcjaWazne")} icon={<Server size={15} />}>
          <p style={paraStyle}>
            {t("traktujemyProdukcje")}<Code>worldofmag.onrender.com</Code> {t("neonTrocheJakSrodowisko")}
            <strong> {t("klikaczeNieJadaPo")}</strong> — i to celowo:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
            <Step
              n={1}
              label="Logowanie"
              desc="Produkcja loguje wyłącznie przez Google OAuth, którego nie da się skryptować. Testy logują się obejściem (provider credentials) aktywnym tylko lokalnie przy E2E_TEST_MODE=1 — na produkcji ono nie istnieje."
            />
            <Step
              n={2}
              label="Dane"
              desc="Testy tworzą i kasują listy, zadania, notatki itd. Puszczenie ich na prawdziwej bazie zaśmieciłoby/uszkodziło Twoje realne dane. Dlatego używamy jednorazowej, lokalnej bazy."
            />
            <Step
              n={3}
              label={t("coWiecTestujemy")}
              desc="Ten sam kod, który jest na produkcji — uruchomiony lokalnie (npm run dev) na czystej bazie. Jeśli klikacze są zielone lokalnie, ten sam build na Render zachowa się tak samo."
            />
          </div>
          <Callout color="var(--accent-amber)" icon={<AlertTriangle size={14} />}>
            {t("jesliKiedysZechceszSmoke")}
          </Callout>
        </Section>

        {/* Jak to działa */}
        <Section title={t("jakToDzialaPod")} icon={<Cog size={15} />}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Step n={1} label="Start serwera" desc="Playwright sam odpala npm run dev z E2E_TEST_MODE=1 (aktywuje testowy login)." />
            <Step n={2} label="Seed" desc="Zakłada użytkowników testowych i komplet uprawnień w bazie (admin = wszystko, limited = tylko strona główna do testów blokad)." />
            <Step n={3} label="Logowanie" desc="Loguje przez endpoint credentials i zapisuje sesję (storage state), reużywaną przez wszystkie testy." />
            <Step n={4} label="Bieg" desc="Projekty 'desktop' i 'mobile' (iPhone 13) klikają scenariusze; przy błędzie zapisują trace + wideo." />
          </div>
        </Section>

        {/* Autoryzacja / bezpieczeństwo */}
        <Section title={t("bezpieczenstwo")} icon={<ShieldCheck size={15} />}>
          <Callout color="var(--accent-green)" icon={<ShieldCheck size={14} />}>
            {t("testowyProviderLogowaniaJest")} <Code>E2E_TEST_MODE</Code>{t("renderNigdyJejNie")} <strong>nie istnieje</strong> — zero ryzyka.
          </Callout>
        </Section>

        {/* Pokrycie */}
        <Section title="Pokrycie scenariuszy" icon={<ListChecks size={15} />}>
          <p style={paraStyle}>
            {t("zrodlemPrawdySaScenariusze")} <Link href="/qa" style={{ color: "var(--accent-red)" }}>/qa</Link> (201
            sztuk, 11 modułów). Część ma już realne, klikające testy; reszta jest w pliku{" "}
            <Code>e2e/specs/coverage.spec.ts</Code> {t("jakoUdokumentowanyBacklogKazdy")} <Code>npm run test:e2e:report</Code>.
          </p>
        </Section>

        {/* Gdzie szukać */}
        <Section title={t("gdzieZnowToZnalezc")} icon={<MousePointerClick size={15} />}>
          <InfoGrid
            rows={[
              { label: "Ta strona", value: "Panel admina → „Testy klikacze E2E” (adres /admin/e2e)." },
              { label: "Pełne README", value: "worldofmag/e2e/README.md w repozytorium." },
              { label: "Scenariusze", value: "Moduł QA: /qa (przeglądanie) oraz /admin/qa (edycja)." },
            ]}
          />
        </Section>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const paraStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  margin: "0 0 12px",
};

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ color: "var(--text-muted)" }}>{icon}</span>
        <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", color: "var(--text-primary)", margin: 0, textTransform: "uppercase" }}>
          {title}
        </h2>
        <div style={{ flex: 1, height: 1, backgroundColor: "var(--border)", marginLeft: 8 }} />
      </div>
      {children}
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{ background: "var(--bg-elevated)", padding: "1px 6px", borderRadius: 4, fontSize: 12, color: "var(--text-primary)" }}>
      {children}
    </code>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre style={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--text-secondary)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px", overflowX: "auto", margin: "0 0 12px" }}>
      <code>{code}</code>
    </pre>
  );
}

function InfoGrid({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      {rows.map((row, i) => (
        <div
          key={row.label}
          style={{
            display: "flex",
            alignItems: "start",
            gap: 12,
            padding: "10px 16px",
            borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : undefined,
          }}
        >
          <span style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "monospace", minWidth: 230, flexShrink: 0 }}>{row.label}</span>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function Step({ n, label, desc }: { n: number; label: string; desc: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "start" }}>
      <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent-red)", color: "var(--on-accent)", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
      <div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0", lineHeight: 1.6 }}>{desc}</p>
      </div>
    </div>
  );
}

function Callout({ color, icon, children }: { color: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "start", background: "var(--bg-surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${color}`, borderRadius: 8, padding: "12px 14px", margin: "0 0 12px" }}>
      <span style={{ color, flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}
