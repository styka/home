import { test } from "node:test";
import assert from "node:assert/strict";
import { pickTeamSuccessor, type TeamMemberLike } from "@/lib/teams/ownership";

// Z-051/Z-194 (T-04) — wybór następcy własności zespołu przy usuwaniu konta właściciela.

const m = (userId: string, role: string, joinedAt: string): TeamMemberLike => ({ userId, role, joinedAt });
const OWNER = "owner";

test("brak innych członków (solo) → null", () => {
  assert.equal(pickTeamSuccessor([m(OWNER, "OWNER", "2020-01-01")], OWNER), null);
  assert.equal(pickTeamSuccessor([], OWNER), null);
});

test("najstarszy stażem ADMIN ma pierwszeństwo (przed młodszymi adminami i członkami)", () => {
  const members = [
    m(OWNER, "OWNER", "2020-01-01"),
    m("member-old", "MEMBER", "2020-02-01"),
    m("admin-young", "ADMIN", "2022-01-01"),
    m("admin-old", "ADMIN", "2021-01-01"),
  ];
  assert.equal(pickTeamSuccessor(members, OWNER), "admin-old");
});

test("brak ADMIN-a → najstarszy stażem zwykły członek", () => {
  const members = [
    m(OWNER, "OWNER", "2020-01-01"),
    m("member-young", "MEMBER", "2023-01-01"),
    m("member-old", "MEMBER", "2021-06-01"),
  ];
  assert.equal(pickTeamSuccessor(members, OWNER), "member-old");
});

test("ADMIN bije starszego stażem zwykłego członka", () => {
  const members = [
    m(OWNER, "OWNER", "2020-01-01"),
    m("member-oldest", "MEMBER", "2020-06-01"),
    m("admin", "ADMIN", "2024-01-01"),
  ];
  assert.equal(pickTeamSuccessor(members, OWNER), "admin");
});

test("leavingUser pomijany nawet jeśli ma najstarszy staż", () => {
  const members = [
    m(OWNER, "OWNER", "2019-01-01"),
    m("admin", "ADMIN", "2020-01-01"),
  ];
  assert.equal(pickTeamSuccessor(members, OWNER), "admin");
});

test("akceptuje różne typy joinedAt (Date / number)", () => {
  const members: TeamMemberLike[] = [
    { userId: OWNER, role: "OWNER", joinedAt: new Date("2020-01-01") },
    { userId: "a", role: "MEMBER", joinedAt: Date.parse("2021-01-01") },
    { userId: "b", role: "MEMBER", joinedAt: new Date("2020-06-01") },
  ];
  assert.equal(pickTeamSuccessor(members, OWNER), "b");
});
