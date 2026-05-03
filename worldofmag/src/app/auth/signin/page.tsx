import { signIn } from "@/lib/auth"

const FEATURES = [
  { icon: "🛒", label: "Lista zakupów",    desc: "Inteligentne listy z kategoriami" },
  { icon: "🏠", label: "Dom i obowiązki",  desc: "Panuj nad codziennymi zadaniami" },
  { icon: "👥", label: "Współdzielenie",   desc: "Teamy i wspólne zasoby" },
  { icon: "⚡", label: "Quick Actions",    desc: "Szybki dostęp do czegokolwiek" },
  { icon: "📝", label: "Notatki",          desc: "Myśli i plany pod ręką" },
  { icon: "📅", label: "Kalendarz",        desc: "Terminy i przypomnienia" },
]

export default function SignInPage() {
  return (
    <>
      <style>{`
        .signin-root {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          background: #0d0d0d;
          overflow: hidden;
        }

        /* ── Left decorative panel ───────────────────────────── */
        .signin-left {
          display: none;
          flex: 1;
          flex-direction: column;
          justify-content: center;
          padding: 64px 56px;
          position: relative;
          overflow: hidden;
        }

        /* radial glow */
        .signin-left::before {
          content: "";
          position: absolute;
          top: -120px;
          left: -80px;
          width: 480px;
          height: 480px;
          border-radius: 50%;
          background: radial-gradient(circle, #7c3aed22 0%, transparent 70%);
          pointer-events: none;
        }
        .signin-left::after {
          content: "";
          position: absolute;
          bottom: -100px;
          right: 0;
          width: 320px;
          height: 320px;
          border-radius: 50%;
          background: radial-gradient(circle, #3b82f622 0%, transparent 70%);
          pointer-events: none;
        }

        .signin-hero-title {
          font-size: 36px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -1px;
          margin-bottom: 8px;
          position: relative;
        }
        .signin-hero-title span {
          background: linear-gradient(135deg, #a78bfa, #60a5fa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .signin-hero-sub {
          font-size: 15px;
          color: #808080;
          margin-bottom: 48px;
          line-height: 1.5;
          max-width: 380px;
          position: relative;
        }

        .signin-features {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          position: relative;
        }
        .signin-feature-card {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 10px;
          padding: 20px;
          transition: border-color 0.2s;
        }
        .signin-feature-card:hover {
          border-color: #3a3a3a;
        }
        .signin-feature-icon {
          font-size: 28px;
          margin-bottom: 10px;
          display: block;
        }
        .signin-feature-label {
          font-size: 15px;
          font-weight: 600;
          color: #e0e0e0;
          margin-bottom: 5px;
        }
        .signin-feature-desc {
          font-size: 13px;
          color: #707070;
          line-height: 1.5;
        }

        /* ── Right / card panel ──────────────────────────────── */
        .signin-right {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 20px;
          background: #0d0d0d;
          position: relative;
        }

        /* Mobile glow behind card */
        .signin-right::before {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 300px;
          height: 300px;
          border-radius: 50%;
          background: radial-gradient(circle, #7c3aed14 0%, transparent 70%);
          pointer-events: none;
        }

        /* mobile: small feature pills above card */
        .signin-mobile-pills {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          margin-bottom: 28px;
          position: relative;
        }
        .signin-pill {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 20px;
          padding: 6px 12px;
          font-size: 12px;
          color: #808080;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        /* The card */
        .signin-card {
          background: #141414;
          border: 1px solid #242424;
          border-radius: 16px;
          padding: 36px 32px;
          width: 100%;
          max-width: 360px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          position: relative;
          box-shadow: 0 0 0 1px #ffffff08, 0 24px 64px #00000060;
        }

        .signin-card-logo {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          margin-bottom: 20px;
          box-shadow: 0 4px 20px #7c3aed40;
        }

        .signin-card-title {
          font-size: 22px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.5px;
          margin-bottom: 6px;
        }

        .signin-card-sub {
          font-size: 13px;
          color: #606060;
          margin-bottom: 28px;
          text-align: center;
        }

        .signin-google-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 12px 20px;
          background: #1e1e1e;
          border: 1px solid #333;
          border-radius: 10px;
          color: #e0e0e0;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .signin-google-btn:hover {
          background: #252525;
          border-color: #444;
        }

        .signin-footer {
          margin-top: 20px;
          font-size: 11px;
          color: #3a3a3a;
          text-align: center;
          line-height: 1.5;
          position: relative;
        }

        /* ── Desktop breakpoint ──────────────────────────────── */
        @media (min-width: 768px) {
          .signin-left {
            display: flex;
          }
          .signin-right {
            width: 440px;
            flex-shrink: 0;
            border-left: 1px solid #1a1a1a;
            background: #0f0f0f;
          }
          .signin-mobile-pills {
            display: none;
          }
          .signin-card {
            max-width: 340px;
          }
        }
      `}</style>

      <div className="signin-root">
        {/* ── Left panel (desktop only) ── */}
        <div className="signin-left">
          <div className="signin-hero-title">
            <span>WorldOfMag</span>
          </div>
          <p className="signin-hero-sub">
            Twój osobisty świat w jednym miejscu.<br />
            Zakupy, zadania, teamy, notatki — wszystko co potrzebne na co dzień.
          </p>

          <div className="signin-features">
            {FEATURES.map((f) => (
              <div key={f.label} className="signin-feature-card">
                <span className="signin-feature-icon">{f.icon}</span>
                <div className="signin-feature-label">{f.label}</div>
                <div className="signin-feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="signin-right">
          {/* Mobile pills (hidden on desktop) */}
          <div className="signin-mobile-pills">
            {FEATURES.map((f) => (
              <div key={f.label} className="signin-pill">
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </div>
            ))}
          </div>

          <div className="signin-card">
            <div className="signin-card-logo">✦</div>
            <div className="signin-card-title">WorldOfMag</div>
            <div className="signin-card-sub">Zaloguj się, aby kontynuować</div>

            <form
              action={async () => {
                "use server"
                await signIn("google", { redirectTo: "/shopping" })
              }}
              style={{ width: "100%" }}
            >
              <button type="submit" className="signin-google-btn">
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.347 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Zaloguj się przez Google
              </button>
            </form>

            <p className="signin-footer">
              Korzystając z aplikacji akceptujesz<br />politykę prywatności WorldOfMag.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
