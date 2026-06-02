"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { ScanLine, ArrowDownToLine, ArrowUpFromLine, Plus, Undo2, Keyboard, PackagePlus, Loader2 } from "lucide-react";
import { BarcodeScanner } from "./BarcodeScanner";
import {
  findStorageItemByCode,
  adjustStorageQuantity,
  addStorageItem,
} from "@/actions/storage";
import { llm } from "@/lib/llm-client";
import { useToast } from "@/components/ui/Toast";

type Mode = "in" | "out";

interface SessionEntry {
  key: string;
  itemId: string;
  name: string;
  delta: number;
  newQty: number;
  at: number;
}

// Krótki sygnał dźwiękowy (WebAudio) — feedback bez plików audio.
function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = ok ? 880 : 300;
    gain.gain.value = 0.08;
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, ok ? 110 : 220);
  } catch {
    /* ignore */
  }
}

export function ScanFlow() {
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>("in");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [session, setSession] = useState<SessionEntry[]>([]);
  const [manual, setManual] = useState("");
  const [pending, startTransition] = useTransition();

  // Nieznany kod → szybkie dodanie pozycji
  const [unknown, setUnknown] = useState<{ code: string; name: string; category: string; unit: string } | null>(null);
  const [enriching, setEnriching] = useState(false);

  const lastScan = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const busy = useRef(false);

  const processCode = useCallback(
    async (code: string) => {
      const c = code.trim();
      if (!c || busy.current || unknown) return;
      const now = Date.now();
      // debounce identycznego kodu (ten sam towar trzymany przed kamerą)
      if (lastScan.current.code === c && now - lastScan.current.at < 1500) return;
      lastScan.current = { code: c, at: now };
      busy.current = true;
      try {
        const item = await findStorageItemByCode(c);
        if (!item) {
          beep(false);
          if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
          setScannerOpen(false);
          setUnknown({ code: c, name: "", category: "", unit: "szt" });
          return;
        }
        const delta = mode === "in" ? 1 : -1;
        const updated = await adjustStorageQuantity(item.id, delta, mode === "in" ? "przyjęcie" : "wydanie", "skan");
        beep(true);
        if (navigator.vibrate) navigator.vibrate(40);
        setSession((s) => [
          { key: `${item.id}-${now}`, itemId: item.id, name: item.name, delta, newQty: updated.quantity ?? 0, at: now },
          ...s,
        ]);
        showToast(`${mode === "in" ? "＋" : "−"} ${item.name} → ${updated.quantity ?? 0}`, "success");
      } catch (e) {
        beep(false);
        showToast(e instanceof Error ? e.message : "Błąd", "error");
      } finally {
        busy.current = false;
      }
    },
    [mode, unknown, showToast]
  );

  function handleManual() {
    if (!manual.trim()) return;
    void processCode(manual);
    setManual("");
  }

  function saveUnknown() {
    if (!unknown) return;
    const name = unknown.name.trim();
    if (!name) {
      showToast("Podaj nazwę", "error");
      return;
    }
    startTransition(async () => {
      try {
        const created = await addStorageItem({
          name,
          barcode: unknown.code,
          category: unknown.category.trim() || null,
          unit: unknown.unit.trim() || null,
          quantity: 0,
        });
        let newQty = 0;
        if (mode === "in") {
          const updated = await adjustStorageQuantity(created.id, 1, "przyjęcie", "nowa pozycja (skan)");
          newQty = updated.quantity ?? 1;
        }
        setSession((s) => [
          { key: `${created.id}-${Date.now()}`, itemId: created.id, name: created.name, delta: mode === "in" ? 1 : 0, newQty, at: Date.now() },
          ...s,
        ]);
        showToast(`Dodano: ${created.name}`, "success");
        setUnknown(null);
        setScannerOpen(true);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  async function enrichUnknown() {
    if (!unknown) return;
    setEnriching(true);
    try {
      const res = await llm.magazynowanie.enrich({ barcode: unknown.code, name: unknown.name || undefined });
      if (res.unavailable) {
        showToast("AI niedostępne", "error");
        return;
      }
      setUnknown((u) =>
        u
          ? {
              ...u,
              name: res.name?.trim() || u.name,
              category: res.category || u.category,
              unit: res.unit || u.unit,
            }
          : u
      );
    } finally {
      setEnriching(false);
    }
  }

  function undo(entry: SessionEntry) {
    startTransition(async () => {
      try {
        await adjustStorageQuantity(entry.itemId, -entry.delta, "korekta", "cofnięcie skanu");
        setSession((s) => s.filter((e) => e.key !== entry.key));
        showToast("Cofnięto", "success");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  const accent = mode === "in" ? "var(--accent-green)" : "var(--accent-red)";

  return (
    <div className="px-4 md:px-6 py-4 max-w-2xl mx-auto flex flex-col gap-4">
      {/* Przełącznik trybu */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("in")}
          className="flex items-center justify-center gap-2 py-3 rounded-lg border font-medium"
          style={{
            borderColor: mode === "in" ? "var(--accent-green)" : "var(--border)",
            backgroundColor: mode === "in" ? "var(--accent-green)" : "var(--bg-surface)",
            color: mode === "in" ? "#0d0d0d" : "var(--text-secondary)",
          }}
        >
          <ArrowDownToLine size={18} /> Przyjęcie
        </button>
        <button
          type="button"
          onClick={() => setMode("out")}
          className="flex items-center justify-center gap-2 py-3 rounded-lg border font-medium"
          style={{
            borderColor: mode === "out" ? "var(--accent-red)" : "var(--border)",
            backgroundColor: mode === "out" ? "var(--accent-red)" : "var(--bg-surface)",
            color: mode === "out" ? "#0d0d0d" : "var(--text-secondary)",
          }}
        >
          <ArrowUpFromLine size={18} /> Wydanie
        </button>
      </div>

      <button
        type="button"
        onClick={() => setScannerOpen(true)}
        className="flex items-center justify-center gap-2 py-4 rounded-lg font-semibold text-base"
        style={{ backgroundColor: accent, color: "#0d0d0d" }}
      >
        <ScanLine size={20} /> Skanuj kod
      </button>

      {/* Ręczne wpisanie kodu */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}>
          <Keyboard size={14} style={{ color: "var(--text-muted)" }} />
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManual()}
            placeholder="Wpisz kod / nazwę ręcznie…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
        <button
          type="button"
          onClick={handleManual}
          className="px-3 py-2 rounded text-sm border"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          OK
        </button>
      </div>

      {/* Sesja skanowania */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Sesja ({session.length})
          </h3>
          {session.length > 0 ? (
            <button type="button" onClick={() => setSession([])} className="text-xs" style={{ color: "var(--text-muted)" }}>
              Wyczyść widok
            </button>
          ) : null}
        </div>
        {session.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
            Zeskanuj kody, aby {mode === "in" ? "przyjąć" : "wydać"} towar. Każdy skan zmienia stan o ±1.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {session.map((e) => (
              <li
                key={e.key}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded text-sm"
                style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
              >
                <span className="flex-1 min-w-0 truncate">{e.name}</span>
                <span className="tabular-nums text-xs" style={{ color: e.delta >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                  {e.delta > 0 ? `+${e.delta}` : e.delta} → {e.newQty}
                </span>
                <button type="button" onClick={() => undo(e)} disabled={pending} aria-label="Cofnij" style={{ color: "var(--text-muted)" }}>
                  <Undo2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {scannerOpen ? (
        <BarcodeScanner
          hint={mode === "in" ? "Przyjęcie — skanuj kody" : "Wydanie — skanuj kody"}
          onDetected={(code) => void processCode(code)}
          onClose={() => setScannerOpen(false)}
        />
      ) : null}

      {/* Nieznany kod → szybkie dodanie */}
      {unknown ? (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div
            className="w-full md:w-[440px] md:rounded border p-4 flex flex-col gap-3"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
          >
            <div className="flex items-center gap-2">
              <PackagePlus size={18} style={{ color: "var(--accent-blue)" }} />
              <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Nieznany kod — dodaj pozycję</h3>
            </div>
            <p className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>Kod: {unknown.code}</p>
            <input
              autoFocus
              value={unknown.name}
              onChange={(e) => setUnknown({ ...unknown, name: e.target.value })}
              placeholder="Nazwa pozycji"
              className="w-full px-3 py-2 rounded border text-sm"
              style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={unknown.category}
                onChange={(e) => setUnknown({ ...unknown, category: e.target.value })}
                placeholder="Kategoria"
                className="px-2 py-1.5 rounded border text-sm"
                style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
              <input
                value={unknown.unit}
                onChange={(e) => setUnknown({ ...unknown, unit: e.target.value })}
                placeholder="Jednostka"
                className="px-2 py-1.5 rounded border text-sm"
                style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={enrichUnknown}
                disabled={enriching}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--accent-purple)" }}
              >
                {enriching ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Podpowiedz AI
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setUnknown(null); setScannerOpen(true); }} className="px-3 py-1.5 rounded text-sm" style={{ color: "var(--text-secondary)" }}>
                  Pomiń
                </button>
                <button type="button" onClick={saveUnknown} disabled={pending} className="px-3 py-1.5 rounded text-sm disabled:opacity-50" style={{ backgroundColor: "var(--accent-blue)", color: "#0d0d0d" }}>
                  Dodaj i licz
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
