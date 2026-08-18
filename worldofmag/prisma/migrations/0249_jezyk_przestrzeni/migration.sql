-- 089 (zadania 34/37, Faza 7) — JĘZYK I STREFA CZASOWA PRZESTRZENI.
--
-- Rozdz. 12.1: „Język i strefa czasowa w ustawieniach PRZESTRZENI (rozdz. 8.2)". Nie w ustawieniach
-- konta — i to jest różnica z konsekwencjami: zasób należy do przestrzeni, więc jego daty i liczby
-- mają być formatowane tak samo dla wszystkich, którzy go widzą. Gdyby język siedział na koncie,
-- ten sam wpis w kalendarzu zespołu wyglądałby inaczej u każdego członka, a wygenerowana przez
-- model treść zapisana w przestrzeni (streszczenie, plan, raport) miałaby język tej osoby, która
-- akurat kliknęła.
--
-- Wartości domyślne odwzorowują stan faktyczny (`pl`, `Europe/Warsaw`), więc migracja niczego nie
-- zmienia w zachowaniu — dokłada nośnik, którego dotąd nie było.

ALTER TABLE "Workspace" ADD COLUMN "locale"   TEXT NOT NULL DEFAULT 'pl';
ALTER TABLE "Workspace" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Warsaw';
