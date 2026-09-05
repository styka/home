-- 123 v2: pierwsze podejscie (0289 + lancuch strona/player/minimalny panel) nie przynioslo
-- transkrypcji na produkcji — filmy wrocily do "niedostepna". v2 wyciaga PRAWDZIWE params
-- panelu transkrypcji (getTranscriptEndpoint ze strony/next) i buduje pelny protobuf wg
-- przepisu Invidiousa, wiec wszystkie "niedostepna" wracaja do kolejki prob jeszcze raz.
-- Proby sacza sie przez limit 25 na przebieg; filmy naprawde bez napisow wroca same.
UPDATE "YoutubeVideo" SET "transkrypcjaStan" = 'oczekuje'
WHERE "transkrypcjaStan" = 'niedostepna';
