// Wyświetlanie lokalnych powiadomień (klient). Współdzielone przez moduły
// Zadania i Nawyki — ten sam mechanizm przypomnień.
//
// Preferuje Service Worker (`registration.showNotification`), bo iOS Safari / PWA
// NIE wspiera konstruktora `new Notification()` — tam działa tylko ścieżka SW.
// Na desktopie SW też działa, a gdy jest niezdrowy, spadamy na konstruktor.
//
// UWAGA: `navigator.serviceWorker.ready` to obietnica, która NIGDY nie jest
// odrzucana — gdy SW nie jest aktywny, zawiesza się w nieskończoność. Dlatego
// ścigamy ją z krótkim timeoutem i przy braku aktywnego SW spadamy na fallback.
export async function showLocalNotification(title: string, options: NotificationOptions): Promise<void> {
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, options);
        return;
      }
    } catch {
      /* spadamy do fallbacku poniżej */
    }
  }
  try {
    new Notification(title, options);
  } catch {
    /* środowisko bez wsparcia powiadomień */
  }
}

/** Czy w tej przeglądarce mamy zgodę na powiadomienia. */
export function notificationsGranted(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

/** Prosi użytkownika o zgodę na powiadomienia; zwraca true gdy przyznano. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  const perm = await Notification.requestPermission();
  return perm === "granted";
}
