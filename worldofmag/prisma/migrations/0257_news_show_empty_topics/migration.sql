-- 085 (AC-14, AC-15): preferencja „pokazuj tematy bez nowych wiadomości".
--
-- Domyślnie FALSE, czyli puste tematy są ukryte — o to prosi zgłoszenie właściciela. Kolumna, a nie
-- wyliczenie z danych: to jest decyzja użytkownika, a nie fakt o tematach.
ALTER TABLE "NewsPref" ADD COLUMN IF NOT EXISTS "showEmptyTopics" BOOLEAN NOT NULL DEFAULT false;

-- 085 (AC-22): filtr statusów obserwatorów pogody znika z interfejsu, więc znika też jego nośnik.
--
-- Właściciel powiedział wprost, że takiego filtra nie chce. Kolumna bez konsumenta byłaby drugim
-- nośnikiem stanu, którego nikt nie czyta — a martwy nośnik zawsze w końcu zaczyna kłamać (lekcja
-- z 084). `watchersLayout` ZOSTAJE: układ listy jest nadal wybierany.
ALTER TABLE "WeatherPref" DROP COLUMN IF EXISTS "watchersFilter";
