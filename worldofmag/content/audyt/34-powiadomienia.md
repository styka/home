# Rozdział 34 — Powiadomienia (Notifications)

## Kontekst / stan z kodu

- **Rdzeń:** `src/actions/notifications.ts`, `src/lib/notifications.ts`; model `Notification`
  (per-user, idempotentny po `dedupeKey`).
- **Mechanizm bez crona:** `syncReminders` skanuje terminy/agendę **przy logowaniu/otwarciu dzwonka**;
  `notifyUser` tworzy powiadomienie; dzwonek (`NotificationBell`) w chrome (sidebar + mobile top bar).
- **Świadomy wybór:** brak crona/web-push (free tier) — przypomnienia „dociągane” przy aktywności usera.

## Mocne strony

- **Działa bez crona** — sprytne obejście ograniczeń free tier (idempotencja po `dedupeKey`).
- Jeden silnik dla wielu źródeł (zadania, zdrowie, flota, zwierzęta, spiżarnia, SRS, usługi).

## Głos Zespołu A — Strażnicy

**Piotr (SRE):** „»Bez crona« ma haczyk: jeśli user się nie zaloguje, **przypomnienie nie powstaje** —
a o to właśnie chodzi w przypomnieniu (»nie zapomnij, choć nie wchodzisz«). To **fundamentalne
ograniczenie**: bez schedulera i web-push to są raczej »powiadomienia przy wejściu«, nie przypomnienia.”

**Basia (PO):** „Niepełne źródła: część terminów (T3 zadania, Z4 wizyty, F2 OC, K4 spiżarnia, L5 SRS)
ma silnik, ale **brakuje podpięć**. To rozproszone, ale wysokie ROI.”

## Głos Zespołu B — Pionierzy

**Kamil (DevOps):** „Dołóżmy **scheduled job** hostingu (Render Cron) + **web-push** (Z-158) — wtedy
przypomnienia działają »na zewnątrz« aplikacji. To zamienia gadżet w realną wartość retencyjną.”

**Ola (UX):** „Preferencje per typ (co i kiedy chcę dostawać) + grupowanie — żeby nie zasypać usera.”

## Punkty sporne

- **Web-push/cron: teraz vs free tier.** **Konsensus:** dodać **scheduled job + web-push** jako warunek,
  by „przypomnienia” były przypomnieniami; to też decyzja kosztowa (poza free tier).

## Głos użytkowników

**Helena (68):** „Przypomnienie o lekach musi przyjść, nawet jak nie wejdę do apki.” → web-push/cron.

## Konsensus i zalecenia

- **Z-390** *(P1 · M)* — **Scheduled job (cron hostingu) + web-push** (Z-158) — przypomnienia działające
  poza aplikacją (warunek sensu funkcji).
- **Z-391** *(P1 · S)* — **Dopiąć brakujące źródła** (T3/Z4/F2/K4/L5) do `syncReminders`; zweryfikować, co
  już skanuje.
- **Z-392** *(P1 · S)* — **Preferencje per typ powiadomienia** + grupowanie (nie zasypywać usera).
- **Z-393** *(P2 · S)* — **Centrum powiadomień** (historia, oznacz wszystkie, filtry) — dziś podstawowe.

## Dobre vs złe praktyki

**Dobre:** idempotencja po `dedupeKey`, jeden silnik wielu źródeł, obejście braku crona na start.
**Złe / do poprawy:** brak crona/web-push czyni z „przypomnień” powiadomienia-przy-wejściu; niepełne źródła.
