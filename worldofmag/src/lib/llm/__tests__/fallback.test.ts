import { test } from "node:test";
import assert from "node:assert/strict";
import { isRetryableLlmStatus } from "@/lib/llm/chat";

// Z-133: decyzja o fallbacku na zapasowy model/dostawcę.
// Przejściowe (limit/serwer/sieć) → próbuj dalej; klienckie 4xx → nie ma sensu.
test("isRetryableLlmStatus: 429 i 5xx przejściowe, 4xx (poza 429) nie", () => {
  // limit — warto spróbować innego dostawcy
  assert.equal(isRetryableLlmStatus(429), true);
  // błędy serwera/bramy/sieci
  assert.equal(isRetryableLlmStatus(500), true);
  assert.equal(isRetryableLlmStatus(502), true);
  assert.equal(isRetryableLlmStatus(503), true);
  // błędy klienta — ten sam request zawiedzie u zapasowego dostawcy
  assert.equal(isRetryableLlmStatus(400), false);
  assert.equal(isRetryableLlmStatus(401), false);
  assert.equal(isRetryableLlmStatus(403), false);
  assert.equal(isRetryableLlmStatus(404), false);
  // sukcesy nie są błędem do ponowienia
  assert.equal(isRetryableLlmStatus(200), false);
});
