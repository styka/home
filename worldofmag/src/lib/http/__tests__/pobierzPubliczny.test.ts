import { test } from "node:test";
import assert from "node:assert/strict";
import { prywatnyAdres } from "../pobierzPubliczny";

test("prywatnyAdres: zakresy prywatne i specjalne są blokowane", () => {
  for (const ip of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "172.31.255.255", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
    assert.equal(prywatnyAdres(ip), true, ip);
  }
});

test("prywatnyAdres: adresy publiczne przechodzą", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "100.128.0.1", "2001:4860:4860::8888", "::ffff:8.8.8.8"]) {
    assert.equal(prywatnyAdres(ip), false, ip);
  }
});
