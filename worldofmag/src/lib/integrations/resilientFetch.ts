// Z-157: ujednolicona warstwa wywołań do integracji zewnętrznych — spójny timeout,
// retry z backoffem na błędy sieci/przejściowe statusy (429/5xx) i miękka degradacja
// (`fetchJsonSafe` zwraca null zamiast rzucać). `fetchImpl`/`sleep` są wstrzykiwalne,
// więc logika retry/timeout jest testowalna deterministycznie (bez sieci i realnych timerów).

export type ResilientOpts = RequestInit & {
  timeoutMs?: number
  retries?: number
  retryOn?: number[]
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const backoff = (attempt: number) => 200 * 2 ** attempt // 200, 400, 800…

/**
 * Wykonuje fetch z timeoutem per próba i retry. Zwraca ostatnią odpowiedź (także
 * non-ok — wołający sprawdza `res.ok`); RZUCA tylko gdy wyczerpano retry na błędzie
 * sieci/timeoucie. Statusy z `retryOn` (domyślnie 429/500/502/503/504) są ponawiane.
 */
export async function resilientFetch(url: string, opts: ResilientOpts = {}): Promise<Response> {
  const {
    timeoutMs = 8000,
    retries = 2,
    retryOn = [429, 500, 502, 503, 504],
    fetchImpl = fetch,
    sleep = defaultSleep,
    ...init
  } = opts

  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(url, { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) })
      if (retryOn.includes(res.status) && attempt < retries) {
        await sleep(backoff(attempt))
        continue
      }
      return res
    } catch (e) {
      lastErr = e
      if (attempt < retries) {
        await sleep(backoff(attempt))
        continue
      }
      throw e
    }
  }
  // Nieosiągalne (pętla albo zwraca, albo rzuca) — dla pełności typów.
  throw lastErr
}

/**
 * Miękka degradacja: zwraca sparsowany JSON albo `null` przy dowolnym błędzie
 * (sieć/timeout/non-ok/zła treść). Loguje ostrzeżenie — integracja nie wywraca strony.
 */
export async function fetchJsonSafe<T = unknown>(url: string, opts: ResilientOpts = {}): Promise<T | null> {
  try {
    const res = await resilientFetch(url, opts)
    if (!res.ok) {
      console.warn(`[integration] ${url} → HTTP ${res.status}`)
      return null
    }
    return (await res.json()) as T
  } catch (e) {
    console.warn(`[integration] ${url} → ${e instanceof Error ? e.message : "błąd"}`)
    return null
  }
}
