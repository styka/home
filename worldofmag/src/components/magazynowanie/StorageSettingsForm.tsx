"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Home, Building2, Check } from "lucide-react";
import { setStorageMode, setStorageCurrency, type StorageMode } from "@/actions/storage";
import { useToast } from "@/components/ui/Toast";

const CURRENCIES = ["PLN", "EUR", "USD", "GBP"];

export function StorageSettingsForm({ mode, currency }: { mode: StorageMode; currency: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [cur, setCur] = useState(currency);

  function chooseMode(next: StorageMode) {
    if (next === mode) return;
    startTransition(async () => {
      await setStorageMode(next);
      showToast(next === "pro" ? "Tryb profesjonalny włączony" : "Tryb Dom włączony", "success");
      router.refresh();
    });
  }

  function saveCurrency(next: string) {
    setCur(next);
    startTransition(async () => {
      await setStorageCurrency(next);
      router.refresh();
    });
  }

  const cards: Array<{ id: StorageMode; title: string; desc: string; icon: typeof Home; color: string }> = [
    {
      id: "home",
      title: "Dom",
      desc: "Garaż, strych, szafy, piwnica. Proste: co mam, gdzie leży, ile zostało, gwarancje i wartość.",
      icon: Home,
      color: "var(--accent-green)",
    },
    {
      id: "pro",
      title: "Profesjonalny",
      desc: "Firma, sklep, hurtownia, kurier. Skan kodów we/wy, dostawcy, dokumenty PZ/WZ, zamówienia, analityka i partie FEFO.",
      icon: Building2,
      color: "var(--accent-purple)",
    },
  ];

  return (
    <div className="px-4 md:px-6 py-6 max-w-2xl mx-auto flex flex-col gap-6">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
          Tryb magazynu
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {cards.map((c) => {
            const active = mode === c.id;
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => chooseMode(c.id)}
                disabled={pending}
                className="text-left rounded-lg border p-4 flex flex-col gap-2 disabled:opacity-60 transition-colors"
                style={{
                  borderColor: active ? c.color : "var(--border)",
                  backgroundColor: active ? "var(--bg-elevated)" : "var(--bg-surface)",
                }}
              >
                <div className="flex items-center justify-between">
                  <Icon size={20} style={{ color: c.color }} />
                  {active ? <Check size={16} style={{ color: c.color }} /> : null}
                </div>
                <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {c.title}
                </div>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {c.desc}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
          Waluta (wycena)
        </h2>
        <div className="flex items-center gap-2">
          {CURRENCIES.map((code) => {
            const active = cur === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => saveCurrency(code)}
                disabled={pending}
                className="px-3 py-1.5 rounded text-sm border disabled:opacity-60"
                style={{
                  borderColor: active ? "var(--accent-blue)" : "var(--border)",
                  backgroundColor: active ? "var(--accent-blue)" : "var(--bg-surface)",
                  color: active ? "#0d0d0d" : "var(--text-secondary)",
                }}
              >
                {code}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          Używana w wycenie pozycji, analityce i eksporcie (np. do ubezpieczenia).
        </p>
      </section>
    </div>
  );
}
