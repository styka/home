import { test } from "node:test";
import assert from "node:assert/strict";
import { idFilmuZOdnosnika, adresKanaluRss, adresMiniatury } from "../filmy";

/** 102 (AC-6) — identyfikator filmu bierzemy z odnośnika, bo kanał RSS nie podaje go osobno. */

test("identyfikator filmu wyciąga się z każdej postaci odnośnika", () => {
  assert.equal(idFilmuZOdnosnika("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(idFilmuZOdnosnika("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42"), "dQw4w9WgXcQ");
  assert.equal(idFilmuZOdnosnika("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(idFilmuZOdnosnika("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(idFilmuZOdnosnika("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
});

test("odnośnik bez identyfikatora daje null", () => {
  assert.equal(idFilmuZOdnosnika("https://www.youtube.com/"), null);
  assert.equal(idFilmuZOdnosnika("https://www.youtube.com/watch?v=zakrotki"), null);
  assert.equal(idFilmuZOdnosnika(""), null);
});

test("adres kanału RSS i miniatury składa się z identyfikatora", () => {
  assert.equal(
    adresKanaluRss("UCXuqSBlHAE6Xw-yeJA0Tunw"),
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCXuqSBlHAE6Xw-yeJA0Tunw"
  );
  assert.match(adresMiniatury("dQw4w9WgXcQ"), /dQw4w9WgXcQ/);
});
