/**
 * Kontrakt modułu **Wiadomości** (wspólna pula artykułów, tematy, linia czasu, gorące tematy).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/news/*` poza `contract`.
 *
 * Konsumenci: narzędzia odczytu asystenta (`agentTools`) i egzekutor jego akcji.
 *
 * Odświeżanie modułu (`startNewsRefresh`) jest w kontrakcie, bo asystent potrafi je uruchomić na
 * prośbę użytkownika. Cała reszta — czytnik, ukrywanie gorących tematów, historia kosztów
 * odświeżania — zostaje prywatna: to mechanika własnego widoku.
 */

export {
  // odczyt
  getTopics,
  getTopicView,
  getSources,
  getHotTopics,
  // tematy i źródła
  createTopic,
  updateTopic,
  deleteTopic,
  createSource,
  updateSource,
  deleteSource,
  // odświeżenie całego modułu
  startNewsRefresh,
} from "./actions/news";
