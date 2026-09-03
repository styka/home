-- 123: naprawa pobierania transkrypcji YouTube (POT na timedtext dawal 200 z pustym cialem,
-- wiec filmy Z napisami ladowaly w "niedostepna" na zawsze — etap 2 odswiezania pobiera tylko
-- "oczekuje"). Jednorazowa rekwalifikacja: wszystkie "niedostepna" wracaja do kolejki prob.
-- Nie da sie odroznic ofiar usterki od filmow naprawde bez napisow; te drugie po jednej probie
-- same wroca do "niedostepna", a proby sacza sie przez limit 25 na przebieg.
UPDATE "YoutubeVideo" SET "transkrypcjaStan" = 'oczekuje'
WHERE "transkrypcjaStan" = 'niedostepna';
