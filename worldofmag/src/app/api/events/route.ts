/**
 * 072 (zadanie 23, rozdz. 11.1) — STRUMIEŃ ZDARZEŃ DO PRZEGLĄDARKI (SSE).
 *
 * Jedno trwałe połączenie na kartę zamiast żądania co 45 sekund. Zastępuje odpytywanie opisane
 * w diagnozie 5.2 jako koszt, który rośnie z liczbą kart, a nie z liczbą zmian.
 */

import { auth } from "@/platform/auth/session";
import { getAccessContext } from "@/platform/sharing/cache";
import { subskrybuj, kanalyDla } from "@/platform/events/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Puls trzymający połączenie przy życiu. Proxy i Render zamykają bezczynne strumienie. */
const PULS_MS = 25_000;

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  // Strumień niesie informację o tym, że w danych użytkownika coś się zmieniło — musi być za sesją.
  if (!userId) return new Response("Nieautoryzowany", { status: 401 });

  // KANAŁY LICZYMY NA SERWERZE, Z SESJI — nigdy z parametru żądania. Przyjęcie identyfikatora
  // przestrzeni od klienta byłoby podsłuchem: wystarczyłoby wpisać cudzy (C-21). Pilnuje tego
  // bramka `check:realtime`.
  const ctx = await getAccessContext(userId);
  const nazwy = kanalyDla(userId, ctx.workspaceIds);

  const encoder = new TextEncoder();
  let puls: NodeJS.Timeout | null = null;
  let odsubskrybuj: (() => void) | null = null;

  const strumien = new ReadableStream<Uint8Array>({
    start(controller) {
      const wyslij = (tekst: string) => {
        try {
          controller.enqueue(encoder.encode(tekst));
        } catch {
          // Karta zniknęła między rozgłoszeniem a zapisem — sprzątanie zrobi `cancel`.
        }
      };

      // Komentarz otwierający: część proxy trzyma odpowiedź w buforze do pierwszego bajtu,
      // więc bez niego `EventSource` po drugiej stronie nie zgłosiłby otwarcia połączenia.
      wyslij(":ok\n\n");

      odsubskrybuj = subskrybuj(nazwy, (sygnal) => {
        // Ładunek celowo UBOGI. Klient ma się odświeżyć, a nie renderować z tego, co przyszło —
        // dane zawsze pobiera z serwera. To zamyka drogę do wycieku treści cudzego zasobu kanałem.
        wyslij(`event: zmiana\ndata: ${JSON.stringify(sygnal)}\n\n`);
      });

      puls = setInterval(() => wyslij(": puls\n\n"), PULS_MS);
    },
    cancel() {
      // Bez tego każda zamknięta karta zostawia słuchacza i timer.
      if (puls) clearInterval(puls);
      odsubskrybuj?.();
    },
  });

  return new Response(strumien, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Wyłącza buforowanie w nginx-podobnych warstwach pośrednich.
      "X-Accel-Buffering": "no",
    },
  });
}
