"use client";

import { useState, useEffect } from "react";

// ─── Section definitions ───────────────────────────────────────────────────

const SECTIONS = [
  { id: "overview",      icon: "🗂️",  title: "Przegląd interfejsu"     },
  { id: "navigation",    icon: "🧭",  title: "Nawigacja i widoki"        },
  { id: "adding",        icon: "➕",  title: "Dodawanie zadań"           },
  { id: "details",       icon: "📋",  title: "Szczegóły zadania"         },
  { id: "status",        icon: "🎯",  title: "Statusy i priorytety"      },
  { id: "dates",         icon: "📅",  title: "Daty i powtarzanie"        },
  { id: "tagsection",    icon: "🏷️", title: "Tagi"                      },
  { id: "subtasks",      icon: "📎",  title: "Podzadania i komentarze"   },
  { id: "search",        icon: "🔍",  title: "Wyszukiwanie i AI"         },
  { id: "sharing",       icon: "🤝",  title: "Udostępnianie"             },
  { id: "notifications", icon: "🔔",  title: "Powiadomienia"             },
  { id: "shortcuts",     icon: "⌨️", title: "Skróty klawiszowe"         },
] as const;

// ─── Helper UI components ──────────────────────────────────────────────────

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-3 rounded-lg mt-3" style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)" }}>
      <span className="text-base flex-shrink-0 leading-5">💡</span>
      <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.65 }}>{children}</p>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-3 rounded-lg mt-3" style={{ background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.2)" }}>
      <span className="text-base flex-shrink-0 leading-5">✦</span>
      <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.65 }}>{children}</p>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block px-1.5 py-0.5 rounded text-xs font-mono mx-0.5"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
      {children}
    </kbd>
  );
}

function Block({ id, icon, title, children }: { id: string; icon: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-14 scroll-mt-6">
      <div className="flex items-center gap-3 mb-5 pb-3" style={{ borderBottom: "2px solid var(--border)" }}>
        <span className="text-2xl">{icon}</span>
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)", lineHeight: 1.75 }}>{children}</p>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold mt-5 mb-2" style={{ color: "var(--text-primary)" }}>{children}</h3>;
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <span style={{ color: "var(--text-muted)", marginTop: 2, flexShrink: 0 }}>•</span>
          <span style={{ lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: item }} />
        </li>
      ))}
    </ul>
  );
}

// ─── SVG Illustrations ─────────────────────────────────────────────────────

function AppLayoutSVG() {
  return (
    <div className="my-5 overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
      <svg viewBox="0 0 700 330" width="100%" style={{ maxWidth: 700, display: "block" }} aria-label="Schemat trójpanelowego interfejsu">
        <defs>
          <clipPath id="cl-layout"><rect width="700" height="330" rx="8"/></clipPath>
        </defs>
        <rect width="700" height="330" fill="#0d0d0d" rx="8"/>

        {/* === LEWA KOLUMNA: SIDEBAR === */}
        <rect x="0" y="0" width="135" height="330" fill="#1a1a1a"/>
        <rect x="0" y="0" width="135" height="44" fill="#161616"/>
        <text x="12" y="27" fill="#a855f7" fontSize="13" fontFamily="system-ui">✦</text>
        <text x="26" y="27" fill="#fff" fontSize="10" fontFamily="system-ui" fontWeight="700">WorldOfMag</text>
        <line x1="0" y1="44" x2="135" y2="44" stroke="#2a2a2a" strokeWidth="1"/>
        <text x="14" y="66" fill="#6b7280" fontSize="9.5" fontFamily="system-ui">🛒  Zakupy</text>
        <rect x="5" y="72" width="125" height="24" rx="4" fill="#242424"/>
        <text x="14" y="89" fill="#fff" fontSize="9.5" fontFamily="system-ui" fontWeight="600">✅  Zadania</text>
        <rect x="5" y="72" width="2" height="24" rx="1" fill="#3b82f6"/>
        <text x="28" y="112" fill="#6b7280" fontSize="8.5" fontFamily="system-ui">📅  Dziś</text>
        <rect x="22" y="116" width="100" height="14" rx="3" fill="#1e293b"/>
        <text x="28" y="127" fill="#60a5fa" fontSize="8.5" fontFamily="system-ui">📅  Dziś</text>
        <text x="28" y="144" fill="#6b7280" fontSize="8.5" fontFamily="system-ui">📆  Nadchodzące</text>
        <text x="28" y="159" fill="#6b7280" fontSize="8.5" fontFamily="system-ui">⚠️  Zaległe</text>
        <text x="28" y="174" fill="#6b7280" fontSize="8.5" fontFamily="system-ui">◎  Wszystkie</text>
        <line x1="18" y1="181" x2="122" y2="181" stroke="#2a2a2a" strokeWidth="0.5"/>
        <text x="28" y="194" fill="#6b7280" fontSize="8.5" fontFamily="system-ui">📥  Skrzynka</text>
        <text x="28" y="209" fill="#6b7280" fontSize="8.5" fontFamily="system-ui">📋  Projekt Dev</text>
        <text x="28" y="224" fill="#6b7280" fontSize="8.5" fontFamily="system-ui">✏  Projekt Blog</text>
        <line x1="18" y1="231" x2="122" y2="231" stroke="#2a2a2a" strokeWidth="0.5"/>
        <text x="28" y="244" fill="#6b7280" fontSize="8.5" fontFamily="system-ui">🏷️  Tagi</text>
        <text x="28" y="259" fill="#6b7280" fontSize="8.5" fontFamily="system-ui">❓  Pomoc</text>
        <text x="14" y="285" fill="#555" fontSize="9.5" fontFamily="system-ui">📓  Notes</text>
        <rect x="10" y="307" width="114" height="16" rx="3" fill="rgba(59,130,246,0.12)"/>
        <text x="67" y="319" fill="#3b82f6" fontSize="8" fontFamily="system-ui" textAnchor="middle">① Panel nawigacji</text>

        {/* === ŚRODKOWA KOLUMNA: LISTA === */}
        <rect x="135" y="0" width="325" height="330" fill="#0d0d0d"/>
        <line x1="135" y1="0" x2="135" y2="330" stroke="#2a2a2a" strokeWidth="1"/>
        <rect x="135" y="0" width="325" height="44" fill="#111"/>
        <text x="150" y="26" fill="#fff" fontSize="12" fontFamily="system-ui" fontWeight="700">📅 Dziś</text>
        <text x="405" y="26" fill="#6b7280" fontSize="9" fontFamily="system-ui">3 aktywne</text>
        <line x1="135" y1="44" x2="460" y2="44" stroke="#2a2a2a" strokeWidth="1"/>
        <rect x="135" y="44" width="325" height="28" fill="#111"/>
        <text x="150" y="62" fill="#3b82f6" fontSize="9" fontFamily="system-ui" fontWeight="600">✦ AI</text>
        <line x1="150" y1="70" x2="173" y2="70" stroke="#3b82f6" strokeWidth="1.5"/>
        <text x="188" y="62" fill="#6b7280" fontSize="9" fontFamily="system-ui">✏ Ręcznie</text>
        <line x1="135" y1="72" x2="460" y2="72" stroke="#2a2a2a" strokeWidth="1"/>
        <rect x="135" y="72" width="325" height="26" fill="#111"/>
        <text x="148" y="89" fill="#3b82f6" fontSize="8" fontFamily="system-ui" fontWeight="600">Wszystkie</text>
        <line x1="148" y1="97" x2="183" y2="97" stroke="#3b82f6" strokeWidth="1.5"/>
        <text x="198" y="89" fill="#6b7280" fontSize="8" fontFamily="system-ui">Do zrobienia</text>
        <text x="262" y="89" fill="#6b7280" fontSize="8" fontFamily="system-ui">W trakcie</text>
        <text x="326" y="89" fill="#6b7280" fontSize="8" fontFamily="system-ui">Zrobione</text>
        <line x1="135" y1="98" x2="460" y2="98" stroke="#2a2a2a" strokeWidth="1"/>
        <rect x="135" y="98" width="325" height="20" fill="#0a0a0a"/>
        <text x="148" y="112" fill="#6b7280" fontSize="8" fontFamily="system-ui">🔴 Pilne  (1)</text>
        <line x1="135" y1="118" x2="460" y2="118" stroke="#2a2a2a" strokeWidth="0.5"/>
        <rect x="135" y="118" width="325" height="34" fill="#1a1a1a"/>
        <rect x="135" y="118" width="2" height="34" fill="#3b82f6"/>
        <rect x="141" y="128" width="3" height="14" rx="1.5" fill="#ef4444"/>
        <circle cx="155" cy="135" r="7" fill="none" stroke="#3b82f6" strokeWidth="1.5"/>
        <text x="167" y="133" fill="#fff" fontSize="9.5" fontFamily="system-ui" fontWeight="500">Raport kwartalny</text>
        <text x="167" y="145" fill="#f59e0b" fontSize="7.5" fontFamily="system-ui">Dziś 14:00</text>
        <rect x="315" y="126" width="28" height="12" rx="5" fill="rgba(59,130,246,0.2)"/>
        <text x="320" y="135" fill="#60a5fa" fontSize="7" fontFamily="system-ui">Praca</text>
        <rect x="135" y="152" width="325" height="20" fill="#0a0a0a"/>
        <text x="148" y="166" fill="#6b7280" fontSize="8" fontFamily="system-ui">🟠 Wysoki  (2)</text>
        <line x1="135" y1="172" x2="460" y2="172" stroke="#2a2a2a" strokeWidth="0.5"/>
        <rect x="141" y="182" width="3" height="14" rx="1.5" fill="#f59e0b"/>
        <circle cx="155" cy="189" r="7" fill="none" stroke="#555" strokeWidth="1.5"/>
        <text x="167" y="187" fill="#b0b0b0" fontSize="9.5" fontFamily="system-ui">Przegląd kodu PR #47</text>
        <text x="167" y="199" fill="#6b7280" fontSize="7.5" fontFamily="system-ui">Dziś  ⏱ 15m</text>
        <rect x="141" y="216" width="3" height="14" rx="1.5" fill="#f59e0b"/>
        <circle cx="155" cy="223" r="7" fill="none" stroke="#555" strokeWidth="1.5"/>
        <text x="167" y="221" fill="#b0b0b0" fontSize="9.5" fontFamily="system-ui">Spotkanie z zespołem</text>
        <text x="167" y="233" fill="#6b7280" fontSize="7.5" fontFamily="system-ui">Dziś</text>
        <rect x="175" y="307" width="120" height="16" rx="3" fill="rgba(59,130,246,0.12)"/>
        <text x="235" y="319" fill="#3b82f6" fontSize="8" fontFamily="system-ui" textAnchor="middle">② Lista zadań</text>

        {/* === PRAWA KOLUMNA: SZCZEGÓŁY === */}
        <rect x="460" y="0" width="240" height="330" fill="#1a1a1a"/>
        <line x1="460" y1="0" x2="460" y2="330" stroke="#2a2a2a" strokeWidth="1"/>
        <text x="474" y="26" fill="#6b7280" fontSize="9" fontFamily="system-ui">Szczegóły zadania</text>
        <text x="680" y="26" fill="#6b7280" fontSize="14" fontFamily="system-ui">×</text>
        <line x1="460" y1="44" x2="700" y2="44" stroke="#2a2a2a" strokeWidth="1"/>
        <rect x="474" y="52" width="82" height="18" rx="3" fill="#1e293b" stroke="#3b82f6" strokeWidth="0.5"/>
        <text x="479" y="64" fill="#60a5fa" fontSize="8.5" fontFamily="system-ui">W trakcie ▾</text>
        <rect x="564" y="52" width="66" height="18" rx="3" fill="#1c0a0a" stroke="#ef4444" strokeWidth="0.5"/>
        <text x="569" y="64" fill="#f87171" fontSize="8.5" fontFamily="system-ui">Wysoki ▾</text>
        <line x1="460" y1="78" x2="700" y2="78" stroke="#2a2a2a" strokeWidth="0.5"/>
        <text x="474" y="97" fill="#fff" fontSize="11" fontFamily="system-ui" fontWeight="700">Raport kwartalny</text>
        <line x1="460" y1="108" x2="700" y2="108" stroke="#2a2a2a" strokeWidth="0.5"/>
        <text x="474" y="122" fill="#6b7280" fontSize="8" fontFamily="system-ui">Opis zadania...</text>
        <line x1="460" y1="133" x2="700" y2="133" stroke="#2a2a2a" strokeWidth="0.5"/>
        <text x="474" y="147" fill="#6b7280" fontSize="8" fontFamily="system-ui">📅 Termin:</text>
        <text x="524" y="147" fill="#b0b0b0" fontSize="8" fontFamily="system-ui">15 maja 14:00</text>
        <text x="474" y="162" fill="#6b7280" fontSize="8" fontFamily="system-ui">⏱ Szacowany czas:</text>
        <text x="572" y="162" fill="#b0b0b0" fontSize="8" fontFamily="system-ui">90 min</text>
        <line x1="460" y1="172" x2="700" y2="172" stroke="#2a2a2a" strokeWidth="0.5"/>
        <text x="474" y="185" fill="#6b7280" fontSize="8" fontFamily="system-ui">Tagi</text>
        <rect x="474" y="190" width="30" height="12" rx="5" fill="rgba(59,130,246,0.2)"/>
        <text x="479" y="199" fill="#60a5fa" fontSize="7" fontFamily="system-ui">Praca</text>
        <rect x="510" y="190" width="22" height="12" rx="5" fill="rgba(16,185,129,0.2)"/>
        <text x="515" y="199" fill="#34d399" fontSize="7" fontFamily="system-ui">Q1</text>
        <line x1="460" y1="208" x2="700" y2="208" stroke="#2a2a2a" strokeWidth="0.5"/>
        <text x="474" y="221" fill="#6b7280" fontSize="8" fontFamily="system-ui">Podzadania  (1/3)</text>
        <text x="474" y="235" fill="#34d399" fontSize="8" fontFamily="system-ui">✓ Zbierz dane</text>
        <text x="474" y="248" fill="#6b7280" fontSize="8" fontFamily="system-ui">○ Analiza danych</text>
        <text x="474" y="261" fill="#6b7280" fontSize="8" fontFamily="system-ui">○ Prezentacja wyników</text>
        <line x1="460" y1="270" x2="700" y2="270" stroke="#2a2a2a" strokeWidth="0.5"/>
        <text x="474" y="283" fill="#6b7280" fontSize="8" fontFamily="system-ui">💬 Komentarze  (2)</text>
        <text x="474" y="296" fill="#555" fontSize="7.5" fontFamily="system-ui">Jan K.: Dane gotowe</text>
        <line x1="460" y1="305" x2="700" y2="305" stroke="#2a2a2a" strokeWidth="0.5"/>
        <text x="474" y="318" fill="#6b7280" fontSize="8" fontFamily="system-ui">🤝 Udostępnianie</text>
        <rect x="505" y="307" width="130" height="16" rx="3" fill="rgba(59,130,246,0.12)"/>
        <text x="570" y="319" fill="#3b82f6" fontSize="8" fontFamily="system-ui" textAnchor="middle">③ Panel szczegółów</text>
      </svg>
    </div>
  );
}

function StatusFlowSVG() {
  return (
    <div className="my-5 overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
      <svg viewBox="0 0 600 210" width="100%" style={{ maxWidth: 600, display: "block" }} aria-label="Cykl życia statusów zadania">
        <defs>
          <marker id="sf-a1" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#555"/></marker>
          <marker id="sf-a2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#3b82f6"/></marker>
          <marker id="sf-a3" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#f59e0b"/></marker>
          <marker id="sf-a4" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#6b7280"/></marker>
        </defs>
        <rect width="600" height="210" fill="#0d0d0d" rx="8"/>

        {/* TODO */}
        <rect x="30" y="55" width="108" height="58" rx="8" fill="#1a1a1a" stroke="#444" strokeWidth="1.5"/>
        <circle cx="60" cy="84" r="11" fill="none" stroke="#6b7280" strokeWidth="2"/>
        <text x="77" y="80" fill="#9ca3af" fontSize="11" fontFamily="system-ui" fontWeight="700">TODO</text>
        <text x="77" y="96" fill="#6b7280" fontSize="8.5" fontFamily="system-ui">Do zrobienia</text>

        <line x1="138" y1="84" x2="196" y2="84" stroke="#555" strokeWidth="1.5" markerEnd="url(#sf-a1)"/>
        <text x="150" y="77" fill="#6b7280" fontSize="7.5" fontFamily="system-ui">spacja / x</text>

        {/* IN_PROGRESS */}
        <rect x="196" y="55" width="128" height="58" rx="8" fill="#0f172a" stroke="#3b82f6" strokeWidth="1.5"/>
        <text x="210" y="80" fill="#3b82f6" fontSize="18" fontFamily="system-ui">⏱</text>
        <text x="234" y="80" fill="#fff" fontSize="10" fontFamily="system-ui" fontWeight="700">W TRAKCIE</text>
        <text x="234" y="95" fill="#60a5fa" fontSize="8" fontFamily="system-ui">IN_PROGRESS</text>

        <line x1="324" y1="84" x2="382" y2="84" stroke="#555" strokeWidth="1.5" markerEnd="url(#sf-a1)"/>
        <text x="332" y="77" fill="#6b7280" fontSize="7.5" fontFamily="system-ui">spacja / x</text>

        {/* DONE */}
        <rect x="382" y="55" width="108" height="58" rx="8" fill="#052e16" stroke="#10b981" strokeWidth="1.5"/>
        <text x="402" y="80" fill="#10b981" fontSize="18" fontFamily="system-ui">✓</text>
        <text x="425" y="80" fill="#34d399" fontSize="11" fontFamily="system-ui" fontWeight="700">DONE</text>
        <text x="425" y="95" fill="#10b981" fontSize="8.5" fontFamily="system-ui">Zrobione</text>

        {/* Cycle arc */}
        <path d="M490,55 L490,28 L84,28 L84,55" fill="none" stroke="#2a2a2a" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#sf-a4)"/>
        <text x="220" y="20" fill="#555" fontSize="7.5" fontFamily="system-ui" textAnchor="middle">↻ cykl (dla zadań powtarzających się)</text>

        {/* DEFERRED */}
        <rect x="196" y="145" width="108" height="40" rx="7" fill="#1c1205" stroke="#f59e0b" strokeWidth="1"/>
        <text x="206" y="162" fill="#fbbf24" fontSize="10" fontFamily="system-ui" fontWeight="600">ODŁOŻONE</text>
        <text x="206" y="176" fill="#92400e" fontSize="8" fontFamily="system-ui">Deferred</text>
        <line x1="260" y1="113" x2="250" y2="145" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3,2" markerEnd="url(#sf-a3)"/>

        {/* CANCELLED */}
        <rect x="382" y="145" width="108" height="40" rx="7" fill="#141414" stroke="#555" strokeWidth="1"/>
        <text x="392" y="162" fill="#9ca3af" fontSize="10" fontFamily="system-ui" fontWeight="600">ANULOWANE</text>
        <text x="392" y="176" fill="#555" fontSize="8" fontFamily="system-ui">Cancelled</text>
        <line x1="436" y1="113" x2="436" y2="145" stroke="#6b7280" strokeWidth="1" strokeDasharray="3,2" markerEnd="url(#sf-a4)"/>

        {/* Labels */}
        <text x="300" y="198" fill="#555" fontSize="8" fontFamily="system-ui" textAnchor="middle">Statusy ODŁOŻONE i ANULOWANE ustawia się ręcznie w panelu szczegółów</text>
      </svg>
    </div>
  );
}

function PrioritySVG() {
  const rows = [
    { label: "Brak",   code: "NONE",   color: "#6b7280", bg: "#1a1a1a", bord: "#333",    desc: "Zadania bez określonego priorytetu"        },
    { label: "Niski",  code: "LOW",    color: "#3b82f6", bg: "#0f172a", bord: "#1d4ed8",  desc: "Mało pilne — zrób kiedy masz czas"          },
    { label: "Średni", code: "MEDIUM", color: "#f59e0b", bg: "#1c1400", bord: "#b45309",  desc: "Ważne, ale nie natychmiastowe"               },
    { label: "Wysoki", code: "HIGH",   color: "#ef4444", bg: "#1c0808", bord: "#b91c1c",  desc: "Pilna sprawa, zajmij się dziś"               },
    { label: "Pilne",  code: "URGENT", color: "#dc2626", bg: "#200606", bord: "#991b1b",  desc: "Natychmiastowe działanie wymagane!",  bold: true },
  ];
  return (
    <div className="my-5 overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
      <svg viewBox="0 0 560 200" width="100%" style={{ maxWidth: 560, display: "block" }} aria-label="Skala priorytetów zadań">
        <rect width="560" height="200" fill="#0d0d0d" rx="8"/>
        <text x="20" y="24" fill="#6b7280" fontSize="9" fontFamily="system-ui" fontWeight="600" letterSpacing="1">PRIORYTET</text>
        <text x="140" y="24" fill="#6b7280" fontSize="9" fontFamily="system-ui" fontWeight="600" letterSpacing="1">KOD</text>
        <text x="240" y="24" fill="#6b7280" fontSize="9" fontFamily="system-ui" fontWeight="600" letterSpacing="1">OPIS</text>
        {rows.map((r, i) => {
          const y = 35 + i * 32;
          return (
            <g key={r.code}>
              <rect x="10" y={y} width="540" height="26" rx="4" fill={r.bg} stroke={r.bord} strokeWidth="0.5"/>
              <rect x="14" y={y + 6} width="4" height="14" rx="2" fill={r.color}/>
              <circle cx="34" cy={y + 13} r="6.5" fill="none" stroke={i === 0 ? "#555" : r.color} strokeWidth="1.5"/>
              <text x="50" y={y + 17} fill={r.color} fontSize="10" fontFamily="system-ui" fontWeight={r.bold ? "700" : "600"}>{r.label}</text>
              <rect x="130" y={y + 6} width={r.code.length * 7 + 8} height="14" rx="3" fill="rgba(0,0,0,0.3)"/>
              <text x="134" y={y + 17} fill="#6b7280" fontSize="7.5" fontFamily="monospace">{r.code}</text>
              <text x="232" y={y + 17} fill="#9ca3af" fontSize="8.5" fontFamily="system-ui">{r.desc}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function RecurringSVG() {
  const days = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
  const nums = [
    [null, null, 1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10, 11, 12],
    [13, 14, 15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24, 25, 26],
    [27, 28, 29, 30, null, null, null],
  ];
  const weeklyDays = [3, 5, 10, 12, 17, 19, 24, 26];
  const dailyFirst = [1, 2, 3, 4, 5];
  return (
    <div className="my-5 overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
      <svg viewBox="0 0 600 240" width="100%" style={{ maxWidth: 600, display: "block" }} aria-label="Wizualizacja zadań cyklicznych">
        <rect width="600" height="240" fill="#0d0d0d" rx="8"/>
        <text x="22" y="24" fill="#b0b0b0" fontSize="10.5" fontFamily="system-ui" fontWeight="700">Przykładowy miesiąc — typy powtarzania</text>

        {/* Calendar */}
        {days.map((d, i) => (
          <text key={d} x={22 + i * 42 + 18} y={46} fill="#6b7280" fontSize="8.5" fontFamily="system-ui" textAnchor="middle" fontWeight="600">{d}</text>
        ))}
        {nums.map((week, wi) =>
          week.map((day, di) => {
            if (!day) return null;
            const isWeekly = weeklyDays.includes(day);
            const isDaily = dailyFirst.includes(day);
            const x = 22 + di * 42 + 18;
            const y = 55 + wi * 34;
            const color = isWeekly ? "#8b5cf6" : isDaily ? "#3b82f6" : null;
            const bgFill = isWeekly ? "rgba(139,92,246,0.2)" : isDaily ? "rgba(59,130,246,0.18)" : "#1a1a1a";
            const stroke = color ?? "#2a2a2a";
            return (
              <g key={day}>
                <rect x={x - 13} y={y - 11} width="28" height="26" rx="5" fill={bgFill} stroke={stroke} strokeWidth={color ? 1.5 : 0.5}/>
                <text x={x} y={y + 4} fill={color ?? "#555"} fontSize="9.5" fontFamily="system-ui" textAnchor="middle" fontWeight={color ? "700" : "400"}>{day}</text>
                {isWeekly && <text x={x} y={y + 13} fill="#8b5cf6" fontSize="7" fontFamily="system-ui" textAnchor="middle">↻</text>}
                {isDaily && <text x={x} y={y + 13} fill="#3b82f6" fontSize="7" fontFamily="system-ui" textAnchor="middle">•</text>}
              </g>
            );
          })
        )}

        {/* Legend */}
        <rect x="316" y="55" width="264" height="140" rx="7" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="1"/>
        <text x="330" y="73" fill="#b0b0b0" fontSize="9.5" fontFamily="system-ui" fontWeight="700">Typy powtarzania</text>
        {[
          { c: "#3b82f6", label: "DAILY",   name: "Codziennie", ex: "np. co 1 dzień" },
          { c: "#8b5cf6", label: "WEEKLY",  name: "Co tydzień", ex: "wybrane dni tyg." },
          { c: "#10b981", label: "MONTHLY", name: "Co miesiąc", ex: "dany dzień m-ca" },
          { c: "#f59e0b", label: "YEARLY",  name: "Co rok",     ex: "ta sama data" },
        ].map((t, i) => (
          <g key={t.label}>
            <rect x="330" y={86 + i * 24} width="10" height="10" rx="2" fill={t.c}/>
            <text x="346" y={96 + i * 24} fill="#b0b0b0" fontSize="9" fontFamily="system-ui" fontWeight="600">{t.name}</text>
            <text x="346" y={107 + i * 24} fill="#6b7280" fontSize="7.5" fontFamily="system-ui">{t.ex}</text>
          </g>
        ))}
        <text x="330" y="188" fill="#555" fontSize="8" fontFamily="system-ui">Każdy typ ma opcję</text>
        <text x="330" y="200" fill="#555" fontSize="8" fontFamily="system-ui">"Koniec powtarzania" (data)</text>
      </svg>
    </div>
  );
}

function AIFlowSVG() {
  return (
    <div className="my-5 overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
      <svg viewBox="0 0 620 195" width="100%" style={{ maxWidth: 620, display: "block" }} aria-label="Schemat funkcji AI w module Zadania">
        <defs>
          <marker id="ai-arr" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#555"/></marker>
        </defs>
        <rect width="620" height="195" fill="#0d0d0d" rx="8"/>

        {/* Input A: Text */}
        <rect x="18" y="28" width="115" height="54" rx="8" fill="#0f172a" stroke="#3b82f6" strokeWidth="1.5"/>
        <text x="28" y="50" fill="#3b82f6" fontSize="22" fontFamily="system-ui">✍</text>
        <text x="56" y="50" fill="#b0b0b0" fontSize="10" fontFamily="system-ui" fontWeight="600">Opis tekstem</text>
        <text x="56" y="64" fill="#6b7280" fontSize="8.5" fontFamily="system-ui">„Zrób raport</text>
        <text x="56" y="74" fill="#6b7280" fontSize="8.5" fontFamily="system-ui">do piątku pilne"</text>

        {/* Input B: Voice */}
        <rect x="18" y="100" width="115" height="54" rx="8" fill="#1c0808" stroke="#ef4444" strokeWidth="1.5"/>
        <text x="28" y="122" fill="#ef4444" fontSize="22" fontFamily="system-ui">🎤</text>
        <text x="56" y="122" fill="#b0b0b0" fontSize="10" fontFamily="system-ui" fontWeight="600">Głos (PL)</text>
        <text x="56" y="136" fill="#6b7280" fontSize="8.5" fontFamily="system-ui">Nagrywasz po</text>
        <text x="56" y="146" fill="#6b7280" fontSize="8.5" fontFamily="system-ui">polsku</text>

        {/* Arrows to AI */}
        <line x1="133" y1="56" x2="208" y2="90" stroke="#444" strokeWidth="1.5" markerEnd="url(#ai-arr)"/>
        <line x1="133" y1="128" x2="208" y2="100" stroke="#444" strokeWidth="1.5" markerEnd="url(#ai-arr)"/>

        {/* AI brain */}
        <rect x="208" y="62" width="120" height="65" rx="9" fill="#150d2e" stroke="#8b5cf6" strokeWidth="2"/>
        <text x="234" y="93" fill="#a855f7" fontSize="28" fontFamily="system-ui">✦</text>
        <text x="262" y="88" fill="#d8b4fe" fontSize="11" fontFamily="system-ui" fontWeight="700">AI</text>
        <text x="262" y="101" fill="#6b7280" fontSize="8" fontFamily="system-ui">Groq LLM</text>
        <text x="262" y="113" fill="#555" fontSize="7.5" fontFamily="system-ui">llama-3.1</text>

        {/* Arrows to outputs */}
        <line x1="328" y1="82" x2="390" y2="52" stroke="#444" strokeWidth="1.5" markerEnd="url(#ai-arr)"/>
        <line x1="328" y1="95" x2="390" y2="95" stroke="#444" strokeWidth="1.5" markerEnd="url(#ai-arr)"/>
        <line x1="328" y1="108" x2="390" y2="140" stroke="#444" strokeWidth="1.5" markerEnd="url(#ai-arr)"/>

        {/* Output 1: Parsed tasks */}
        <rect x="390" y="22" width="210" height="48" rx="7" fill="#052e16" stroke="#10b981" strokeWidth="1"/>
        <text x="400" y="40" fill="#34d399" fontSize="10" fontFamily="system-ui" fontWeight="700">✓ Zadania z danymi</text>
        <text x="400" y="54" fill="#6b7280" fontSize="8" fontFamily="system-ui">tytuł, priorytet, data, powtarzanie</text>
        <text x="400" y="63" fill="#555" fontSize="7.5" fontFamily="system-ui">Możesz edytować przed zapisem</text>

        {/* Output 2: Subtasks */}
        <rect x="390" y="75" width="210" height="42" rx="7" fill="#150d2e" stroke="#8b5cf6" strokeWidth="1"/>
        <text x="400" y="92" fill="#a855f7" fontSize="10" fontFamily="system-ui" fontWeight="700">✦ Sugestie podzadań</text>
        <text x="400" y="107" fill="#6b7280" fontSize="8" fontFamily="system-ui">AI proponuje listę kroków</text>

        {/* Output 3: Estimate */}
        <rect x="390" y="122" width="210" height="42" rx="7" fill="#1c1400" stroke="#f59e0b" strokeWidth="1"/>
        <text x="400" y="139" fill="#fbbf24" fontSize="10" fontFamily="system-ui" fontWeight="700">⏱ Szacowany czas</text>
        <text x="400" y="154" fill="#6b7280" fontSize="8" fontFamily="system-ui">Estymacja minut w det. panelu</text>

        {/* Output 4: Semantic search */}
        <rect x="390" y="169" width="210" height="20" rx="5" fill="#111" stroke="#333" strokeWidth="0.5"/>
        <text x="400" y="182" fill="#555" fontSize="8" fontFamily="system-ui">🔍  Semantyczne wyszukiwanie</text>
      </svg>
    </div>
  );
}

function KeyboardSVG() {
  type KeyDef = { key: string; w: number; active?: boolean; label?: string };
  const rows: KeyDef[][] = [
    [
      { key: "Esc", w: 36, active: true, label: "Zamknij" },
      { key: "`", w: 24 }, { key: "1", w: 24, active: true, label: "Filtr 1" },
      { key: "2", w: 24, active: true, label: "Filtr 2" },
      { key: "3", w: 24, active: true, label: "Filtr 3" },
      { key: "4", w: 24, active: true, label: "Filtr 4" },
      { key: "5", w: 24, active: true, label: "Filtr 5" },
      { key: "6", w: 24 }, { key: "7", w: 24 }, { key: "8", w: 24 },
      { key: "9", w: 24 }, { key: "0", w: 24 },
    ],
    [
      { key: "Tab", w: 38 }, { key: "q", w: 24 }, { key: "w", w: 24 },
      { key: "e", w: 24, active: true, label: "Edytuj" },
      { key: "r", w: 24 }, { key: "t", w: 24 }, { key: "y", w: 24 },
      { key: "u", w: 24 }, { key: "i", w: 24 }, { key: "o", w: 24 },
      { key: "p", w: 24 },
    ],
    [
      { key: "Caps", w: 44 },
      { key: "a", w: 24, active: true, label: "Dodaj" },
      { key: "s", w: 24 },
      { key: "d", w: 24, active: true, label: "Usuń" },
      { key: "f", w: 24, active: true, label: "Szukaj" },
      { key: "g", w: 24 }, { key: "h", w: 24 },
      { key: "j", w: 24, active: true, label: "↓" },
      { key: "k", w: 24, active: true, label: "↑" },
      { key: "l", w: 24 },
    ],
    [
      { key: "Shift", w: 56 }, { key: "z", w: 24 },
      { key: "x", w: 24, active: true, label: "Status" },
      { key: "c", w: 24 }, { key: "v", w: 24 }, { key: "b", w: 24 },
      { key: "n", w: 24, active: true, label: "Dodaj" },
      { key: "m", w: 24 },
    ],
    [
      { key: "Ctrl", w: 38 }, { key: "Alt", w: 32 },
      { key: "Spacja", w: 120, active: true, label: "Status" },
      { key: "Alt", w: 32 }, { key: "Ctrl", w: 38 },
    ],
  ];

  return (
    <div className="my-5 overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
      <svg viewBox="0 0 700 215" width="100%" style={{ maxWidth: 700, display: "block" }} aria-label="Skróty klawiszowe">
        <rect width="700" height="215" fill="#0d0d0d" rx="8"/>
        {rows.map((row, ri) => {
          let x = 12;
          return (
            <g key={ri}>
              {row.map((k, ki) => {
                const y = 12 + ri * 37;
                const kx = x;
                x += k.w + 4;
                const fontSize = k.key.length > 4 ? 6 : k.key.length > 2 ? 7.5 : 9.5;
                return (
                  <g key={ki}>
                    <rect x={kx} y={y} width={k.w} height={30} rx="4"
                      fill={k.active ? "rgba(139,92,246,0.28)" : "#1e1e1e"}
                      stroke={k.active ? "#8b5cf6" : "#333"}
                      strokeWidth={k.active ? 1.5 : 0.5}/>
                    <text x={kx + k.w / 2} y={y + (k.label ? 12 : 19)}
                      fill={k.active ? "#d8b4fe" : "#555"}
                      fontSize={fontSize} fontFamily="system-ui"
                      textAnchor="middle" fontWeight={k.active ? "700" : "400"}>{k.key}</text>
                    {k.label && (
                      <text x={kx + k.w / 2} y={y + 24}
                        fill="#7c3aed" fontSize={5.5} fontFamily="system-ui" textAnchor="middle">{k.label}</text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
        {/* Legend */}
        <rect x="430" y="12" width="255" height="150" rx="7" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="1"/>
        <text x="443" y="28" fill="#d8b4fe" fontSize="9.5" fontFamily="system-ui" fontWeight="700">Pełna lista skrótów</text>
        {[
          ["a / n",       "Dodaj zadanie (focus)"],
          ["j / ↓",       "Następne zadanie"],
          ["k / ↑",       "Poprzednie zadanie"],
          ["e",           "Otwórz / edytuj zadanie"],
          ["d / Del",     "Usuń zadanie"],
          ["x / spacja",  "Zmień status"],
          ["f / /",       "Otwórz wyszukiwanie"],
          ["1 – 5",       "Filtr statusu"],
          ["Ctrl+K",      "Paleta poleceń"],
          ["Esc",         "Zamknij panel / wyczyść"],
        ].map(([key, action], i) => (
          <g key={i}>
            <rect x="443" y={36 + i * 13} width={key.length * 5.8 + 4} height="11" rx="2" fill="#2a2a2a"/>
            <text x="445" y={46 + i * 13} fill="#a855f7" fontSize="7" fontFamily="monospace">{key}</text>
            <text x={443 + key.length * 5.8 + 10} y={46 + i * 13} fill="#6b7280" fontSize="7.5" fontFamily="system-ui">{action}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function SharingSVG() {
  return (
    <div className="my-5 overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
      <svg viewBox="0 0 560 160" width="100%" style={{ maxWidth: 560, display: "block" }} aria-label="Schemat udostępniania zadania">
        <defs>
          <marker id="sh-arr" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#444"/></marker>
        </defs>
        <rect width="560" height="160" fill="#0d0d0d" rx="8"/>

        {/* Task box */}
        <rect x="20" y="45" width="130" height="70" rx="8" fill="#1a1a1a" stroke="#3b82f6" strokeWidth="1.5"/>
        <text x="35" y="70" fill="#3b82f6" fontSize="16" fontFamily="system-ui">📋</text>
        <text x="60" y="70" fill="#b0b0b0" fontSize="10" fontFamily="system-ui" fontWeight="600">Zadanie</text>
        <text x="35" y="90" fill="#6b7280" fontSize="8.5" fontFamily="system-ui">Raport Q1</text>
        <text x="35" y="104" fill="#6b7280" fontSize="8" fontFamily="system-ui">Priorytet: Wysoki</text>

        {/* Arrow */}
        <line x1="150" y1="80" x2="220" y2="80" stroke="#444" strokeWidth="1.5" markerEnd="url(#sh-arr)"/>
        <text x="163" y="72" fill="#6b7280" fontSize="8" fontFamily="system-ui">email</text>

        {/* Users */}
        {[
          { y: 35,  label: "Ania K.",   role: "Edytor",  color: "#3b82f6", roleColor: "#1d4ed8", roleBg: "#0f172a" },
          { y: 80,  label: "Bartek W.", role: "Widz",    color: "#10b981", roleColor: "#059669", roleBg: "#052e16" },
          { y: 125, label: "Ciszewski", role: "Widz",    color: "#8b5cf6", roleColor: "#6d28d9", roleBg: "#1a0d3a" },
        ].map((u) => (
          <g key={u.label}>
            <circle cx="250" cy={u.y + 12} r="14" fill={u.color + "22"} stroke={u.color} strokeWidth="1.5"/>
            <text x="250" y={u.y + 16} fill={u.color} fontSize="10" fontFamily="system-ui" textAnchor="middle" fontWeight="700">
              {u.label.charAt(0)}
            </text>
            <text x="272" y={u.y + 10} fill="#b0b0b0" fontSize="9.5" fontFamily="system-ui" fontWeight="600">{u.label}</text>
            <rect x="272" y={u.y + 14} width={u.role.length * 6 + 8} height="13" rx="5" fill={u.roleBg} stroke={u.roleColor} strokeWidth="0.7"/>
            <text x="276" y={u.y + 24} fill={u.roleColor} fontSize="7.5" fontFamily="system-ui" fontWeight="600">{u.role}</text>
          </g>
        ))}

        {/* Role description */}
        <rect x="360" y="30" width="182" height="100" rx="8" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="1"/>
        <text x="372" y="48" fill="#b0b0b0" fontSize="9.5" fontFamily="system-ui" fontWeight="700">Role dostępu</text>
        <text x="372" y="66" fill="#60a5fa" fontSize="9" fontFamily="system-ui" fontWeight="600">Edytor</text>
        <text x="372" y="78" fill="#6b7280" fontSize="8" fontFamily="system-ui">Może edytować zadanie,</text>
        <text x="372" y="89" fill="#6b7280" fontSize="8" fontFamily="system-ui">dodawać komentarze</text>
        <text x="372" y="107" fill="#34d399" fontSize="9" fontFamily="system-ui" fontWeight="600">Widz</text>
        <text x="372" y="119" fill="#6b7280" fontSize="8" fontFamily="system-ui">Tylko odczyt i</text>
        <text x="372" y="130" fill="#6b7280" fontSize="8" fontFamily="system-ui">komentarze</text>
      </svg>
    </div>
  );
}

// ─── Main Guide Component ──────────────────────────────────────────────────

export function TasksGuide() {
  const [activeId, setActiveId] = useState("overview");

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-10% 0px -55% 0px", threshold: 0 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Sticky TOC (desktop) ── */}
      <nav
        className="hidden lg:flex flex-col w-52 border-r overflow-y-auto flex-shrink-0 py-4 gap-0.5"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        <p className="px-4 mb-2 text-xs font-semibold tracking-widest" style={{ color: "var(--text-muted)" }}>
          SPIS TREŚCI
        </p>
        {SECTIONS.map((s) => {
          const isActive = activeId === s.id;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex items-center gap-2 px-4 py-1.5 text-xs"
              style={{
                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                backgroundColor: isActive ? "var(--bg-elevated)" : undefined,
                borderLeft: isActive ? "2px solid var(--accent-blue)" : "2px solid transparent",
                textDecoration: "none",
                transition: "color 0.15s",
              }}
            >
              <span style={{ fontSize: 13 }}>{s.icon}</span>
              <span style={{ lineHeight: 1.4 }}>{s.title}</span>
            </a>
          );
        })}
      </nav>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)" }}>
        <div className="max-w-3xl mx-auto px-6 py-8">

          {/* Hero header */}
          <div className="mb-10 pb-8" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-4xl">✅</span>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  Przewodnik użytkownika
                </h1>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Moduł Zadania — WorldOfMag</p>
              </div>
            </div>
            <P>
              Moduł <strong style={{ color: "var(--text-primary)" }}>Zadania</strong> to zaawansowany menadżer zadań
              zintegrowany z resztą aplikacji WorldOfMag. Obsługuje projekty, priorytety, powtarzanie, podzadania,
              tagi, udostępnianie oraz funkcje sztucznej inteligencji — w tym wprowadzanie głosowe i semantyczne
              wyszukiwanie. Ten przewodnik przeprowadzi Cię przez każdą funkcję krok po kroku.
            </P>
            <div className="flex flex-wrap gap-2 mt-4">
              {["Projekty", "5 priorytetów", "Powtarzanie", "AI + głos", "Tagi", "Udostępnianie", "Skróty vim"].map((t) => (
                <span key={t} className="text-xs px-2.5 py-1 rounded-full"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* ─────────────────── 1. PRZEGLĄD ─────────────────── */}
          <Block id="overview" icon="🗂️" title="Przegląd interfejsu">
            <P>
              Interfejs Zadań podzielony jest na <strong style={{ color: "var(--text-primary)" }}>trzy obszary</strong>,
              widoczne jednocześnie na szerokim ekranie:
            </P>
            <AppLayoutSVG />
            <Ul items={[
              "<strong>① Panel nawigacji</strong> (lewy sidebar) — przełączaj widoki i projekty. Dostępny globalnie w aplikacji.",
              "<strong>② Lista zadań</strong> (środek) — wyświetla zadania aktywnego widoku z filtrem statusu i tagów. Tu dodajesz nowe zadania.",
              "<strong>③ Panel szczegółów</strong> (prawy panel) — otwiera się po kliknięciu zadania. Edytujesz tu wszystkie pola, podzadania i komentarze.",
            ]}/>
            <Tip>
              Na małych ekranach (mobile) panel szczegółów otwiera się jako pełnoekranowy modal. Wróć do listy
              przyciskiem <strong>×</strong> lub skrótem <Kbd>Esc</Kbd>.
            </Tip>
          </Block>

          {/* ─────────────────── 2. NAWIGACJA ─────────────────── */}
          <Block id="navigation" icon="🧭" title="Nawigacja i widoki">
            <P>
              Lewy sidebar zawiera dwa rodzaje pozycji nawigacyjnych: <strong style={{ color: "var(--text-primary)" }}>widoki wirtualne</strong>
              &nbsp;(predefiniowane filtry) oraz <strong style={{ color: "var(--text-primary)" }}>projekty</strong>
              &nbsp;(Twoje kolekcje zadań).
            </P>
            <H3>Widoki wirtualne</H3>
            <Ul items={[
              "<strong>📅 Dziś</strong> — zadania z terminem na bieżący dzień, posortowane wg priorytetu.",
              "<strong>📆 Nadchodzące</strong> — zadania z terminem od jutra do ~30 dni, grupowane wg dnia tygodnia.",
              "<strong>⚠️ Zaległe</strong> — zadania po terminie (niezrobione), posortowane od najstarszego.",
              "<strong>◎ Wszystkie</strong> — wszystkie Twoje zadania ze wszystkich projektów.",
            ]}/>
            <H3>Projekty</H3>
            <Ul items={[
              "<strong>📥 Skrzynka (Inbox)</strong> — projekt tworzony automatycznie. Nowe zadania dodane z widoków wirtualnych trafiają tu domyślnie.",
              "<strong>Własne projekty</strong> — możesz tworzyć nieograniczoną liczbę projektów (emoji + nazwa). Ikona ołówka pojawia się po najechaniu — kliknij by zmienić nazwę.",
              "<strong>+ Nowy projekt</strong> — kliknij na dole listy projektów i wpisz nazwę.",
              "<strong>🏷️ Tagi</strong> — link do strony zarządzania tagami.",
              "<strong>❓ Pomoc</strong> — ten przewodnik.",
            ]}/>
            <Tip>
              Kliknij ikonę kosza 🗑️ (pojawia się przy projekcie po najechaniu), aby usunąć projekt.
              <strong> Uwaga: usunięcie projektu usuwa wszystkie zadania w nim!</strong>
            </Tip>
          </Block>

          {/* ─────────────────── 3. DODAWANIE ─────────────────── */}
          <Block id="adding" icon="➕" title="Dodawanie zadań">
            <P>
              Na górze listy zadań widoczne są dwa tryby dodawania. Przełączasz je zakładkami
              &nbsp;<strong style={{ color: "var(--text-primary)" }}>AI</strong> oraz
              &nbsp;<strong style={{ color: "var(--text-primary)" }}>Ręcznie</strong>.
            </P>
            <H3>Ręczne dodawanie</H3>
            <P>
              Szybki formularz w jednej linii. Wpisz tytuł zadania i opcjonalnie ustaw datę.
              Priorytet ustawia się przyciskiem po lewej (klikaj aby cyklować: — → ↓ → ◆ → ↑ → ‼).
              Zatwierdź Enterem lub przyciskiem <strong>+</strong>.
            </P>
            <Tip>
              Naciśnij <Kbd>a</Kbd> lub <Kbd>n</Kbd> z dowolnego miejsca na liście, aby natychmiast
              przenieść kursor do pola dodawania w trybie Ręcznie.
            </Tip>
            <H3>Dodawanie przez AI</H3>
            <P>
              Opisz jedno lub więcej zadań naturalnym językiem, np.:
              <em style={{ color: "var(--text-muted)", display: "block", marginTop: 6, paddingLeft: 12, borderLeft: "3px solid var(--border)" }}>
                „Przygotuj prezentację na piątek, priorytet wysoki. Kup mleko i chleb jutro. Zadzwoń do klienta Kowalski — pilne."
              </em>
            </P>
            <P>
              AI wyciągnie kilka zadań jednocześnie z priorytetami, datami i tagami. Przed dodaniem możesz
              każde z nich przejrzeć i edytować w podglądzie.
            </P>
            <H3>Wprowadzanie głosowe 🎤</H3>
            <P>
              W trybie AI kliknij ikonę mikrofonu. Mów po polsku — transkrypcja pojawi się automatycznie
              w polu tekstowym, gotowa do analizy przez AI. Wymaga zgody przeglądarki na mikrofon
              (jednorazowy popup).
            </P>
            <AIFlowSVG />
            <Note>
              Funkcje AI wymagają aktywnego połączenia z internetem — używają modelu Groq LLM (llama-3.1-8b).
              W razie problemu z siecią spróbuj ponownie lub skorzystaj z trybu Ręcznie.
            </Note>
          </Block>

          {/* ─────────────────── 4. SZCZEGÓŁY ─────────────────── */}
          <Block id="details" icon="📋" title="Szczegóły zadania">
            <P>
              Kliknij dowolne zadanie na liście, aby otworzyć panel szczegółów po prawej stronie.
              Wszystkie pola zapisują się <strong style={{ color: "var(--text-primary)" }}>automatycznie</strong>
              &nbsp;przy opuszczeniu pola (blur) lub po chwili bezczynności (600 ms debounce).
            </P>
            <H3>Dostępne pola</H3>
            <Ul items={[
              "<strong>Status</strong> — rozwijane: Do zrobienia / W trakcie / Zrobione / Odłożone / Anulowane.",
              "<strong>Priorytet</strong> — rozwijane: Brak / Niski / Średni / Wysoki / Pilne.",
              "<strong>Tytuł</strong> — edytowalny, zapisuje się po kliknięciu poza pole.",
              "<strong>Opis</strong> — wieloliniowe pole tekstowe. Obsługuje Markdown (podgląd w przyszłych wersjach).",
              "<strong>Termin (due date)</strong> — data i godzina końca zadania. Wpływa na widoki Dziś / Zaległe / Nadchodzące.",
              "<strong>Start</strong> — opcjonalna data rozpoczęcia.",
              "<strong>Szacowany czas</strong> — czas w minutach + przycisk ✦ AI do automatycznej estymacji.",
              "<strong>Tagi</strong> — kliknij tag aby przypisać/odpiąć. Możesz też wpisać nową nazwę i ją dodać.",
              "<strong>Powtarzanie</strong> — kliknij sekcję aby rozwinąć konfigurację (patrz sekcja 6).",
              "<strong>Podzadania</strong> — lista kroków z postępem (np. 2/5).",
              "<strong>Komentarze</strong> — dyskusja pod zadaniem z timestampami.",
              "<strong>Udostępnianie</strong> — zarządzaj dostępem innych użytkowników.",
            ]}/>
            <Tip>
              Przycisk kosza 🗑️ w nagłówku panelu usuwa zadanie po potwierdzeniu.
              Operacja jest <strong>nieodwracalna</strong>.
            </Tip>
          </Block>

          {/* ─────────────────── 5. STATUSY ─────────────────── */}
          <Block id="status" icon="🎯" title="Statusy i priorytety">
            <H3>Cykl statusów</H3>
            <P>
              Każde zadanie przechodzi przez cykl statusów. Możesz zmieniać status klikając ikonę
              przy zadaniu na liście, skrótem <Kbd>spacja</Kbd> / <Kbd>x</Kbd>, lub z dropdownu
              w panelu szczegółów.
            </P>
            <StatusFlowSVG />
            <Ul items={[
              "<strong>TODO</strong> — zadanie do zrobienia. Stan domyślny.",
              "<strong>IN_PROGRESS</strong> — w toku. Widoczne w filtrze „W trakcie".",
              "<strong>DONE</strong> — zakończone. Dla zadań cyklicznych tworzy automatycznie następne wystąpienie.",
              "<strong>DEFERRED</strong> — odłożone na później. Nie pojawia się w widoku Dziś.",
              "<strong>CANCELLED</strong> — anulowane. Widoczne tylko w filtrze „Anulowane".",
            ]}/>
            <H3>Skala priorytetów</H3>
            <P>
              Priorytet wpływa na kolejność grupowania zadań w widokach ALL, Dziś i Projekt — od Pilne na górze.
            </P>
            <PrioritySVG />
            <Tip>
              Kolor paska po lewej stronie każdego wiersza na liście zadań odpowiada priorytetowi —
              dzięki temu od razu widzisz co jest najważniejsze.
            </Tip>
          </Block>

          {/* ─────────────────── 6. DATY ─────────────────── */}
          <Block id="dates" icon="📅" title="Daty i powtarzanie">
            <H3>Termin (Due date)</H3>
            <P>
              Ustaw datę i godzinę ukończenia zadania. System koloruje terminy na liście:
              czerwony = po terminie, pomarańczowy = dziś.
            </P>
            <H3>Szacowany czas</H3>
            <P>
              Wpisz czas w minutach lub kliknij przycisk <strong style={{ color: "var(--accent-purple)" }}>✦ AI</strong>,
              aby AI oszacowało na podstawie tytułu i opisu. Czas wyświetla się też na wierszu listy (np. <em>⏱ 45m</em>).
            </P>
            <H3>Powtarzanie</H3>
            <P>
              Kliknij „Ustaw powtarzanie" w panelu szczegółów. Dostępne typy:
            </P>
            <RecurringSVG />
            <Ul items={[
              "<strong>Codziennie (DAILY)</strong> — co N dni, np. co 1, co 2 dni.",
              "<strong>Co tydzień (WEEKLY)</strong> — wybrane dni tygodnia (Pn/Wt/Śr...) co N tygodni.",
              "<strong>Co miesiąc (MONTHLY)</strong> — ten sam dzień miesiąca, co N miesięcy.",
              "<strong>Co rok (YEARLY)</strong> — ta sama data roku, co N lat.",
              "<strong>Koniec powtarzania</strong> — opcjonalna data, po której zadanie nie pojawi się ponownie.",
            ]}/>
            <P>
              Kiedy oznaczysz cykliczne zadanie jako DONE, system automatycznie tworzy
              <strong style={{ color: "var(--text-primary)" }}> nowe zadanie</strong> z kolejnym terminem
              zgodnym z regułą powtarzania.
            </P>
            <Note>
              Kliknij „Zapisz" po skonfigurowaniu reguły — zmiany nie zapisują się automatycznie dla
              sekcji powtarzania. Kliknij „Usuń powtarzanie", aby wyłączyć cykl.
            </Note>
          </Block>

          {/* ─────────────────── 7. TAGI ─────────────────── */}
          <Block id="tagsection" icon="🏷️" title="Tagi">
            <P>
              Tagi to kolorowe etykiety przypisywane do zadań. Możesz je tworzyć globalnie i używać
              w dowolnych projektach. Każdy tag ma unikalną nazwę i kolor.
            </P>
            <H3>Zarządzanie tagami</H3>
            <P>
              Przejdź do <strong style={{ color: "var(--text-primary)" }}>🏷️ Tagi</strong> w sidebarsie
              (pod listą projektów). Znajdziesz tam stronę zarządzania gdzie możesz:
            </P>
            <Ul items={[
              "Tworzyć nowe tagi (nazwa + wybór koloru z palety 8 kolorów).",
              "Edytować istniejące tagi (kliknij ikonę ołówka).",
              "Usuwać tagi (kliknij kosz — tag znika ze wszystkich zadań!).",
            ]}/>
            <H3>Filtrowanie po tagach</H3>
            <P>
              W górnej części listy zadań widoczne są wszystkie Twoje tagi. Kliknij tag aby go wybrać —
              lista przefiltruje się do zadań posiadających <strong style={{ color: "var(--text-primary)" }}>wszystkie</strong>
              &nbsp;wybrane tagi jednocześnie (logika AND). Kliknij tag ponownie aby odznaczyć.
            </P>
            <Tip>
              Przypisywanie tagów do zadania odbywa się w panelu szczegółów — kliknij na tag aby
              go aktywować (pełna jasność) lub dezaktywować (szary, 35% opacity).
              Możesz też wpisać nową nazwę tagu i nacisnąć Enter aby go stworzyć i od razu przypisać.
            </Tip>
          </Block>

          {/* ─────────────────── 8. PODZADANIA ─────────────────── */}
          <Block id="subtasks" icon="📎" title="Podzadania i komentarze">
            <H3>Podzadania</H3>
            <P>
              Każde zadanie może mieć nieograniczoną liczbę podzadań. W nagłówku sekcji widoczny
              jest postęp, np. <em>Podzadania (2/5)</em>.
            </P>
            <Ul items={[
              "Wpisz tytuł podzadania w polu na dole sekcji i naciśnij <strong>Enter</strong> lub ikonę <strong>+</strong>.",
              "Zaznacz checkbox przy podzadaniu aby oznaczyć je jako ukończone (zmienia status na DONE).",
              "Kliknij przycisk <strong>✦ AI</strong> obok nagłówka — AI zaproponuje do 6 podzadań na podstawie tytułu i opisu zadania.",
              "Podzadania sugerowane przez AI pojawiają się listą — kliknij <strong>+</strong> przy każdym aby je dodać.",
            ]}/>
            <H3>Komentarze</H3>
            <P>
              Sekcja komentarzy służy do dyskusji i notatek związanych z zadaniem. Widoczna jest nazwa
              użytkownika i timestamp każdego komentarza.
            </P>
            <Ul items={[
              "Wpisz komentarz w polu tekstowym i naciśnij <Kbd>Enter</Kbd> lub ikonę wysłania.",
              "Możesz usunąć swoje komentarze (ikona kosza przy własnym komentarzu).",
              "Komentarze są widoczne dla wszystkich użytkowników mających dostęp do zadania.",
            ]}/>
            <Tip>
              Liczba komentarzy widoczna jest jako ikonka 📎 na wierszu zadania na liście — szybka
              informacja że zadanie ma dyskusję bez otwierania panelu.
            </Tip>
          </Block>

          {/* ─────────────────── 9. WYSZUKIWANIE ─────────────────── */}
          <Block id="search" icon="🔍" title="Wyszukiwanie i AI">
            <H3>Wyszukiwanie tekstowe</H3>
            <P>
              Naciśnij <Kbd>/</Kbd>, <Kbd>f</Kbd> lub ikonę lupy w nagłówku. Wyszukiwanie filtruje
              zadania w czasie rzeczywistym po: tytule, opisie i nazwach tagów.
            </P>
            <H3>Semantyczne wyszukiwanie AI</H3>
            <P>
              Po wpisaniu frazy naciśnij <Kbd>Enter</Kbd> lub kliknij przycisk
              <strong style={{ color: "var(--accent-purple)" }}> ✦ AI</strong>. Model językowy
              przeszuka do 100 zadań i zwróci wyniki dopasowane znaczeniowo — nawet jeśli słowa
              się nie pokrywają. Np. zapytanie „zadania związane z klientami" znajdzie
              „Raport kwartalny", „Prezentacja dla Kowalskiego" itp.
            </P>
            <P>
              Aktywne wyniki AI oznaczone są banerem w kolorze fioletowym. Kliknij <strong>×</strong>
              w banerze aby wrócić do normalnego widoku.
            </P>
            <H3>Podsumowanie funkcji AI</H3>
            <AIFlowSVG />
            <Ul items={[
              "<strong>Parsowanie tekstu / głosu</strong> — opisujesz zadania, AI wyciąga tytuły, priorytety, daty, tagi i reguły powtarzania.",
              "<strong>Wyszukiwanie semantyczne</strong> — znajdź zadania po znaczeniu, nie tylko po słowach kluczowych.",
              "<strong>Sugestie podzadań</strong> — AI proponuje kroki do wykonania dla danego zadania.",
              "<strong>Szacowanie czasu</strong> — AI szacuje czas realizacji na podstawie opisu zadania.",
            ]}/>
          </Block>

          {/* ─────────────────── 10. UDOSTĘPNIANIE ─────────────────── */}
          <Block id="sharing" icon="🤝" title="Udostępnianie">
            <P>
              Możesz udostępnić dowolne zadanie innym użytkownikom systemu. Otwórz panel szczegółów
              i znajdź sekcję <strong style={{ color: "var(--text-primary)" }}>Udostępnianie</strong>.
            </P>
            <SharingSVG />
            <H3>Jak udostępnić zadanie</H3>
            <Ul items={[
              "Wpisz adres e-mail użytkownika w polu wyszukiwania.",
              "Wybierz rolę: <strong>Widz</strong> (tylko odczyt) lub <strong>Edytor</strong> (pełna edycja).",
              "Kliknij przycisk <strong>+</strong> — jeśli użytkownik istnieje w systemie, otrzyma dostęp natychmiast.",
              "Lista aktywnych udziałowców pojawia się powyżej pola. Kliknij ikonę usunięcia aby cofnąć dostęp.",
            ]}/>
            <Note>
              Udostępnianie działa na poziomie pojedynczego zadania. Aby udostępnić cały projekt,
              poproś administratora o dodanie użytkownika jako członka projektu.
            </Note>
          </Block>

          {/* ─────────────────── 11. POWIADOMIENIA ─────────────────── */}
          <Block id="notifications" icon="🔔" title="Powiadomienia">
            <P>
              Aplikacja może wysyłać powiadomienia przeglądarkowe o zbliżających się terminach zadań.
            </P>
            <H3>Włączanie powiadomień</H3>
            <P>
              Kliknij ikonę dzwonka 🔔 w prawym górnym rogu listy zadań. Przeglądarka wyświetli
              popup z prośbą o zezwolenie — kliknij <strong>Zezwól</strong>. Ikona zmieni kolor
              na pomarańczowy.
            </P>
            <H3>Kiedy pojawia się powiadomienie</H3>
            <Ul items={[
              "System sprawdza zadania przy każdym załadowaniu strony z modułem Zadania.",
              "Powiadomienie pojawia się dla zadań, których termin (due date) wypada <strong>w ciągu najbliższych 30 minut</strong>.",
              "Powiadomienia dotyczą tylko zadań niezakończonych (status inny niż DONE i CANCELLED).",
            ]}/>
            <Note>
              Powiadomienia przeglądarkowe działają tylko jeśli aplikacja jest otwarta w przeglądarce.
              Na iOS (iPhone / iPad) wymagają zainstalowania aplikacji jako PWA (Dodaj do ekranu głównego).
            </Note>
          </Block>

          {/* ─────────────────── 12. SKRÓTY ─────────────────── */}
          <Block id="shortcuts" icon="⌨️" title="Skróty klawiszowe">
            <P>
              Interfejs jest zaprojektowany z myślą o pracy z klawiatury. Większość akcji dostępna
              jest bez sięgania po myszkę — styl podobny do Vim / Linear.
            </P>
            <KeyboardSVG />
            <H3>Pełna tabela skrótów</H3>
            <div className="overflow-x-auto mt-2 rounded-lg" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: "var(--text-muted)", width: 160 }}>Skrót</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Akcja</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [["a", "n"],          "Przenieś kursor do pola dodawania zadania"],
                    [["j", "↓"],          "Przesuń zaznaczenie w dół listy"],
                    [["k", "↑"],          "Przesuń zaznaczenie w górę listy"],
                    [["e"],               "Otwórz panel szczegółów dla zaznaczonego zadania"],
                    [["d", "Delete"],     "Usuń zaznaczone zadanie"],
                    [["x", "Spacja"],     "Cykluj status (TODO → W trakcie → Zrobione)"],
                    [["f", "/"],          "Otwórz wyszukiwarkę"],
                    [["1", "2", "3", "4", "5"], "Przełącz filtr statusu (kolejne zakładki)"],
                    [["Ctrl+K"],          "Otwórz paletę poleceń (Command Palette)"],
                    [["Esc"],             "Zamknij panel szczegółów / wyczyść wyszukiwanie / odznacz"],
                  ].map(([keys, action], i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          {(keys as string[]).map((k, ki) => (
                            <span key={ki}><Kbd>{k}</Kbd>{ki < (keys as string[]).length - 1 && <span style={{ color: "var(--text-muted)", fontSize: 10 }}> lub </span>}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: "var(--text-secondary)" }}>{action as string}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Tip>
              Skróty działają tylko gdy kursor <strong>nie jest</strong> w polu tekstowym.
              Naciśnij <Kbd>Esc</Kbd> aby opuścić pole i wrócić do nawigacji klawiaturą.
            </Tip>
          </Block>

          {/* Footer */}
          <div className="mt-8 pt-6 text-center" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              WorldOfMag — Moduł Zadania &nbsp;·&nbsp; Wróć do{" "}
              <a href="/tasks/today" style={{ color: "var(--accent-blue)", textDecoration: "none" }}>listy zadań</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
