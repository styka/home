"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnchoredLayer } from "@/components/ui/AnchoredLayer";
import { useRouter } from "next/navigation";
import { Bell, Check, X, Users, Clock } from "lucide-react";
import {
  syncReminders,
  getNotifications,
  getLicznikiSkrzynki,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationDTO,
} from "@/actions/notifications";
import { acceptInvitation, getPendingInvitations, rejectInvitation } from "@/actions/invitations";
import { PrzelacznikSegmentowy } from "@/components/ui/nav/PrzelacznikSegmentowy";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import type { RodzajPowiadomienia } from "@/types";
import { MODULE_META, type CalendarModule } from "@/modules/calendar/contract";

function accentFor(module: string): string {
  const m = MODULE_META[module as CalendarModule];
  if (m) return m.accent;
  if (module === "services") return "var(--accent-blue)";
  return "var(--accent-purple)";
}

/** Zaproszenie do zespołu, tak jak zwraca je `getPendingInvitations`. */
type ZaproszenieDTO = Awaited<ReturnType<typeof getPendingInvitations>>[number];

/**
 * SKRZYNKA ODBIORCZA (dawniej: dzwonek powiadomień). Przy montażu uruchamia skan terminów pod
 * free tier (`syncReminders` — bez crona, idempotentny po dedupeKey), pokazuje licznik spraw
 * czekających i listę w rozwijanym panelu. Klik pozycji oznacza ją jako przeczytaną i nawiguje
 * do źródła.
 *
 * 107 — DWA SEGMENTY ZAMIAST JEDNEGO WORKA.
 *
 * Do 107 wpadało tu wszystko naraz: termin zadania, przegląd auta i powtórka słówek obok
 * udostępnionego zasobu. Zaproszenie do zespołu nie wpadało wcale — widać je było wyłącznie jako
 * **bezimienna czerwona kropka na hamburgerze**, i tylko na telefonie. Rozdzielamy więc sprawy
 * na dwie listy, **przełącznikiem segmentowym, nie menu**: segment mówi jednocześnie, co jest
 * dostępne i co jest wybrane — menu nie mówi ani jednego, ani drugiego (reguła z przebiegu 100).
 *
 *  * **Do zrobienia** — przypomnienia (`rodzaj = "zadanie"`).
 *  * **Relacje** — sprawy Z LUDŹMI: żywe zaproszenia do zespołu (z akcjami przyjmij/odrzuć
 *    wykonywanymi NA MIEJSCU) oraz powiadomienia `rodzaj = "relacja"` (udostępnienia, zbiorcze
 *    sygnały z rozmów).
 *
 * **Zaproszenia czytamy z ICH WŁASNEJ tabeli, nie z kopii w powiadomieniach.** Kopia byłaby drugim
 * nośnikiem tego samego stanu i przeżyłaby przyjęcie — panel pokazywałby sprawę, której już nie ma.
 * Dzięki jednemu źródłu panel i strona `/invitations` nie mają jak się rozjechać (AC-9), bo wołają
 * te same akcje.
 *
 * Element chrome (nie pływający FAB) — osadzany w nawigacji:
 *  - `placement="sidebar"` → wiersz z etykietą w stopce sidebara; panel rozwija się W GÓRĘ,
 *  - `placement="topbar"` → kompaktowa ikona w górnym pasku (mobile); panel rozwija się W DÓŁ,
 *  - `placement="chrome"` → kompaktowa ikona w RZĘDZIE CHROMU sidebara; panel W DÓŁ (086: rząd
 *    przeniósł się ze stopki pod nazwę aplikacji, więc otwieranie w górę wyszłoby poza ekran).
 *
 * 085: trzeci wariant powstał, bo dwie decyzje były tu dotąd SKLEJONE w jedną: kształt
 * (wiersz z etykietą kontra sama ikona) i kierunek panelu (w górę kontra w dół). Rząd chromu na
 * komputerze potrzebuje kombinacji, której nie dało się wyrazić — ikony z panelem w górę. Zamiast
 * dokładać czwarty prop rozdzielamy je wewnątrz: `zWierszem` i `wGore` liczone z `placement`.
 */
export function NotificationBell({ placement = "topbar" }: { placement?: "topbar" | "sidebar" | "chrome" }) {
  const t = useTranslations("components.shell.NotificationBell");
  const router = useRouter();
  const confirmDialog = useConfirm();
  const [open, setOpen] = useState(false);
  const [liczniki, setLiczniki] = useState({ zadania: 0, relacje: 0 });
  const [segment, setSegment] = useState<RodzajPowiadomienia>("zadanie");
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [zaproszenia, setZaproszenia] = useState<ZaproszenieDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const count = liczniki.zadania + liczniki.relacje;

  const odswiezLiczniki = useCallback(async () => {
    try {
      setLiczniki(await getLicznikiSkrzynki());
    } catch {
      /* powłoka ma działać także wtedy, gdy licznik się nie policzy */
    }
  }, []);

  // Skan przy wejściu (logowanie / pierwszy render powłoki). `syncReminders` zwraca liczbę
  // nieprzeczytanych przypomnień, ale odznaka pokazuje SUMĘ obu segmentów, więc po skanie i tak
  // pytamy o liczniki — inaczej zaproszenie czekające od tygodnia nie zapaliłoby odznaki.
  useEffect(() => {
    syncReminders()
      .catch(() => {})
      .finally(() => void odswiezLiczniki());
  }, [odswiezLiczniki]);

  const load = useCallback(async (rodzaj: RodzajPowiadomienia) => {
    setLoading(true);
    try {
      const [list, inv] = await Promise.all([
        getNotifications({ rodzaj }),
        rodzaj === "relacja" ? getPendingInvitations() : Promise.resolve([] as ZaproszenieDTO[]),
      ]);
      setItems(list);
      setZaproszenia(inv);
      await odswiezLiczniki();
    } finally {
      setLoading(false);
    }
  }, [odswiezLiczniki]);

  const toggle = useCallback(() => {
    setOpen((o) => {
      const next = !o;
      if (next) void load(segment);
      return next;
    });
  }, [load, segment]);

  const wybierzSegment = useCallback((id: string) => {
    const rodzaj: RodzajPowiadomienia = id === "relacja" ? "relacja" : "zadanie";
    setSegment(rodzaj);
    void load(rodzaj);
  }, [load]);

  // Zamykanie klikiem poza panelem i Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    // 080 (Z7): Esc i klik poza obszarem obsługuje teraz `AnchoredLayer`. Ten nasłuch zostaje
    // wyłącznie na kliknięcie w samą kotwicę spoza panelu (przycisk dzwonka w innym rozmieszczeniu).
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const onItem = useCallback(async (n: NotificationDTO) => {
    if (!n.readAt) {
      await markNotificationRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      void odswiezLiczniki();
    }
    setOpen(false);
    if (n.href) router.push(n.href);
  }, [router, odswiezLiczniki]);

  const onMarkAll = useCallback(async () => {
    // Gasimy WYŁĄCZNIE oglądaną listę. Przycisk stoi nad jednym segmentem, więc zgaszenie obu
    // byłoby utratą informacji wykonaną cudzym gestem.
    await markAllNotificationsRead(segment);
    setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    void odswiezLiczniki();
  }, [segment, odswiezLiczniki]);

  const onPrzyjmij = useCallback(async (z: ZaproszenieDTO) => {
    await acceptInvitation(z.id);
    setZaproszenia((prev) => prev.filter((x) => x.id !== z.id));
    void odswiezLiczniki();
    // Zasoby nowego zespołu mają być widoczne od razu, bez ręcznego przeładowania (AC-6).
    router.refresh();
  }, [router, odswiezLiczniki]);

  const onOdrzuc = useCallback(async (z: ZaproszenieDTO) => {
    if (!(await confirmDialog({
      title: t("odrzucicZaproszenie", { zespol: z.team.name }),
      description: t("odrzucenieOpis"),
      confirmLabel: t("odrzuc"),
      destructive: true,
    }))) return;
    await rejectInvitation(z.id);
    setZaproszenia((prev) => prev.filter((x) => x.id !== z.id));
    void odswiezLiczniki();
  }, [confirmDialog, t, odswiezLiczniki]);

  /** Kształt: wiersz z etykietą (tylko `sidebar`) kontra sama ikona. */
  const zWierszem = placement === "sidebar";
  /** Kierunek panelu: tylko wiersz w STOPCE otwiera się w górę; reszta w dół. */
  const wGore = placement === "sidebar";
  /**
   * 107 (AC-13): na telefonie ikona jest CELEM DOTYKU i musi mieć 44 × 44 px (C-31). W rzędzie
   * chromu na komputerze zostaje geometria ustalona w 086 — tam celuje mysz, a podniesienie samej
   * tej ikony rozjechałoby rząd z czterema sąsiadkami.
   */
  const rozmiarPrzycisku = placement === "topbar" ? 44 : 34;
  const opisIkony = count > 0 ? t("skrzynkaZLicznikiem", { ile: count }) : t("skrzynka");

  return (
    <div ref={panelRef} className="relative" style={zWierszem ? undefined : { display: "flex" }}>
      {zWierszem ? (
        <button
          onClick={toggle}
          aria-label={opisIkony}
          className="flex items-center gap-3 px-4 py-2 mx-2 rounded text-sm w-[calc(100%-1rem)]"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.color = "var(--text-secondary)"; }}
        >
          <Bell size={18} style={{ flexShrink: 0 }} />
          <span>{t("skrzynka")}</span>
          {count > 0 && (
            <span style={{ marginLeft: "auto", background: "var(--accent-red)", color: "var(--on-accent, #fff)", fontSize: 11, borderRadius: 999, padding: "1px 6px", minWidth: 18, textAlign: "center" }}>
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      ) : (
        <button
          onClick={toggle}
          aria-label={opisIkony}
          className="flex items-center justify-center rounded-full"
          style={{ width: rozmiarPrzycisku, height: rozmiarPrzycisku, background: "transparent", border: "none", color: "var(--text-secondary)", position: "relative" }}
        >
          <Bell size={19} />
          {count > 0 && (
            <span
              style={{
                position: "absolute", top: placement === "topbar" ? 4 : -1, right: placement === "topbar" ? 4 : -1,
                minWidth: 16, height: 16, padding: "0 4px",
                borderRadius: 99, background: "var(--accent-red)", color: "var(--on-accent, #fff)",
                fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      )}

      <AnchoredLayer
        anchorRef={panelRef}
        open={open}
        onClose={() => setOpen(false)}
        role="dialog"
        ariaLabel={t("skrzynka")}
        // Kierunek zostaje ten sam co dotąd — w stopce paska bocznego w górę, w górnym pasku w dół
        // — ale teraz jest to PREFERENCJA: przy braku miejsca warstwa odbija się na drugą stronę,
        // zamiast wyjść poza ekran (080/Z7).
        side={wGore ? "gora" : "dol"}
        align={zWierszem ? "start" : "koniec"}
        width={360}
        style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg, 10px)", boxShadow: "0 12px 32px rgba(0,0,0,0.45)" }}
      >
        <div>
          <div
            className="flex items-center justify-between"
            style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-surface)" }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t("skrzynka")}</span>
            <div className="flex items-center gap-1">
              {items.some((n) => !n.readAt) && (
                <button onClick={onMarkAll} title={t("oznaczWszystkie")}
                  className="flex items-center gap-1" style={{ fontSize: 11, color: "var(--text-muted)", padding: "3px 6px" }}>
                  <Check size={13} /> {t("wszystkie")}
                </button>
              )}
              <button onClick={() => setOpen(false)} aria-label={t("zamknij")} style={{ color: "var(--text-muted)", padding: 4 }}>
                <X size={15} />
              </button>
            </div>
          </div>

          {/* 107 (AC-1..AC-3): przełącznik stoi POD nagłówkiem i NAD listą — poza obszarem, który
              się przewija. `wylaczona: false` przekazujemy jawnie, bo komponent domyślnie wyłącza
              segment o liczniku zero; tutaj byłoby to szkodliwe, bo pusta lista „Relacje" jest
              jedynym miejscem, w którym widać, że taka lista w ogóle istnieje. */}
          <div style={{ padding: "8px 12px 4px" }}>
            <PrzelacznikSegmentowy
              ariaLabel={t("rodzajeSpraw")}
              wybrana={segment}
              onWybor={wybierzSegment}
              pozycje={[
                { id: "zadanie", etykieta: t("segmentDoZrobienia"), licznik: liczniki.zadania, wylaczona: false },
                { id: "relacja", etykieta: t("segmentRelacje"), licznik: liczniki.relacje, wylaczona: false },
              ]}
            />
          </div>

          {loading && items.length === 0 && zaproszenia.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)" }}>{t("ladowanie")}</div>
          ) : items.length === 0 && zaproszenia.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
              {segment === "relacja" ? t("brakRelacji") : t("brakPowiadomienPrzypomnieniaO")}
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {/* Zaproszenia idą PIERWSZE i mają własne akcje — to jedyne pozycje, na które
                  odpowiada się decyzją, a nie przeczytaniem. */}
              {zaproszenia.map((z) => (
                <li key={z.id} style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" }}>
                  <div className="flex items-start gap-2" style={{ minWidth: 0 }}>
                    <Users size={14} style={{ color: "var(--accent-blue)", marginTop: 2, flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontSize: 12.5, color: "var(--text-primary)", fontWeight: 600 }}>
                        {t("zaproszenieDoZespolu", { zespol: z.team.name })}
                      </span>
                      <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        {t("zapraszaCie", { kto: z.invitedBy.name ?? z.invitedBy.email ?? "" })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" style={{ marginTop: 8, paddingLeft: 22 }}>
                    <button
                      onClick={() => void onPrzyjmij(z)}
                      style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 6, border: "none", background: "var(--accent-green)", color: "var(--on-accent, #fff)", cursor: "pointer" }}
                    >
                      {t("przyjmij")}
                    </button>
                    <button
                      onClick={() => void onOdrzuc(z)}
                      style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
                    >
                      {t("odrzuc")}
                    </button>
                  </div>
                </li>
              ))}

              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => onItem(n)}
                    className="flex items-start gap-2 w-full text-left"
                    style={{
                      padding: "10px 12px", borderBottom: "1px solid var(--border)",
                      background: n.readAt ? "transparent" : "var(--bg-hover)",
                    }}
                  >
                    {/* 107 (AC-4): rodzaj sprawy widać BEZ czytania treści. Kropka modułu zostaje —
                        mówi, skąd sprawa przyszła; ikona mówi, czym jest. */}
                    {n.rodzaj === "relacja"
                      ? <Users size={13} style={{ color: accentFor(n.module), marginTop: 3, flexShrink: 0 }} />
                      : <Clock size={13} style={{ color: accentFor(n.module), marginTop: 3, flexShrink: 0 }} />}
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 12.5, color: "var(--text-primary)", fontWeight: n.readAt ? 400 : 600 }}>
                        {n.title}
                      </span>
                      {n.body && (
                        <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{n.body}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </AnchoredLayer>
    </div>
  );
}
