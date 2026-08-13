# Weryfikacja: odwołanie dostępu — zadanie 17

Data: 2026-08-13 · Build **exit 0**, `test:unit` **733/733**, liczniki **160 / 551 / 35 / 35**.

**AC-1** ✅ dostęp odebrany sprawdzany **bezpośrednio potem** — bez `sleep`, bez czyszczenia cache,
bez drugiego żądania. **AC-2** ✅ nadanie z minioną `expiresAt` nie daje nic. **AC-3** ✅ kontrola
mocy: to samo nadanie z datą przyszłą **działa** — bez tego AC-2 mogłoby być zielone z dowolnego
innego powodu. **AC-4** ✅.

**Werdykt: GOTOWE.** Pozycja 17 checklisty domknięta w części, którą da się dziś sprawdzić; część
SSE odnotowana przy zadaniu 23.
