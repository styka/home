import { test } from "node:test"
import assert from "node:assert/strict"
import { splitSentences } from "@/lib/speech/sentences"

// 039: błąd w podziale na zdania jest widoczny wprost — lektor podświetla zdanie, które czyta, więc
// przecięcie w środku wypowiedzi od razu rzuca się w oczy. Stąd test na przypadkach granicznych.

test("dzieli proste zdania po kropce, wykrzykniku i pytajniku", () => {
  assert.deepEqual(
    splitSentences("Pierwsze zdanie. Drugie zdanie! Trzecie zdanie?"),
    ["Pierwsze zdanie.", "Drugie zdanie!", "Trzecie zdanie?"],
  )
})

test("skróty nie kończą zdania", () => {
  assert.deepEqual(
    splitSentences("Kupili np. rowery. Potem wrócili."),
    ["Kupili np. rowery.", "Potem wrócili."],
  )
  assert.deepEqual(
    splitSentences("W 2024 r. wydarzyło się wiele. Koniec."),
    ["W 2024 r. wydarzyło się wiele.", "Koniec."],
  )
  assert.deepEqual(
    splitSentences("Spotkanie o godz. 18 w sali nr 3. Zapraszamy."),
    ["Spotkanie o godz. 18 w sali nr 3.", "Zapraszamy."],
  )
  assert.deepEqual(
    splitSentences("Mówił o tym m.in. prof. Kowalski. Nikt nie oponował."),
    ["Mówił o tym m.in. prof. Kowalski.", "Nikt nie oponował."],
  )
})

test("inicjał nie kończy zdania", () => {
  assert.deepEqual(
    splitSentences("Zabrał głos J. Kowalski. Sala ucichła."),
    ["Zabrał głos J. Kowalski.", "Sala ucichła."],
  )
})

test("liczby z kropką zostają w jednym kawałku", () => {
  assert.deepEqual(splitSentences("Wynik to 3.14 metra."), ["Wynik to 3.14 metra."])
  assert.deepEqual(
    splitSentences("Cena wzrosła do 1.500 złotych. To dużo."),
    ["Cena wzrosła do 1.500 złotych.", "To dużo."],
  )
})

test("wielokropek i „?!” to jeden koniec zdania", () => {
  assert.deepEqual(
    splitSentences("Nie wiadomo... Zobaczymy?! Może jutro."),
    ["Nie wiadomo...", "Zobaczymy?!", "Może jutro."],
  )
})

test("domykający cudzysłów zostaje przy swoim zdaniu", () => {
  assert.deepEqual(
    splitSentences("Powiedział: „To koniec.” Wyszedł."),
    ["Powiedział: „To koniec.”", "Wyszedł."],
  )
})

test("mała litera po kropce oznacza, że zdanie trwa", () => {
  assert.deepEqual(
    splitSentences("Przyszedł ok. dziesiątej rano. Nikogo nie było."),
    ["Przyszedł ok. dziesiątej rano.", "Nikogo nie było."],
  )
})

test("adres i wersja nie są rozcinane", () => {
  assert.deepEqual(splitSentences("Zobacz na example.com/artykuł."), ["Zobacz na example.com/artykuł."])
})

test("pusty akapit kończy zdanie nawet bez interpunkcji", () => {
  assert.deepEqual(splitSentences("Nagłówek\n\nTreść artykułu."), ["Nagłówek", "Treść artykułu."])
})

test("tekst bez interpunkcji wraca jako jedno zdanie", () => {
  assert.deepEqual(splitSentences("Bez żadnej kropki"), ["Bez żadnej kropki"])
})

test("pusty tekst daje pustą listę", () => {
  assert.deepEqual(splitSentences(""), [])
  assert.deepEqual(splitSentences("   \n  "), [])
})

test("nadmiarowe białe znaki są przycięte, nic nie ginie", () => {
  const text = "  Pierwsze.   Drugie.\n\n Trzecie.  "
  const parts = splitSentences(text)
  assert.deepEqual(parts, ["Pierwsze.", "Drugie.", "Trzecie."])
  // Suma znaków niebiałych musi się zgadzać — lektor nie może zgubić fragmentu tekstu.
  const strip = (s: string) => s.replace(/\s+/g, "")
  assert.equal(parts.map(strip).join(""), strip(text))
})
