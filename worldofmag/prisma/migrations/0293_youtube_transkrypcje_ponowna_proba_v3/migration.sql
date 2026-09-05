-- 123 v3: drogi bezposrednie do YouTube (v1/v2) padly na blokadzie IP centrow danych.
-- v3 dodaje droge przez publiczne instancje Piped/Invidious (i opcjonalne proxy z Config),
-- wiec filmy oznaczone "niedostepna" wracaja do kolejki prob jeszcze raz.
UPDATE "YoutubeVideo" SET "transkrypcjaStan" = 'oczekuje'
WHERE "transkrypcjaStan" = 'niedostepna';
