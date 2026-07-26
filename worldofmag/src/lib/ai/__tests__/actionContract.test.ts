import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ACTION_CONTRACTS,
  actionLabel,
  fieldSpec,
  paramLabel,
  validateActionParams,
  valueLabel,
} from "@/lib/ai/actionContract";

describe("actionContract — etykiety dla użytkownika", () => {
  it("zwraca polską nazwę akcji zamiast technicznego typu", () => {
    assert.equal(actionLabel({ type: "update_task_status" }), "Zmień status zadania");
    assert.equal(actionLabel({ type: "submit_feedback" }), "Wyślij zgłoszenie do administratora");
  });

  it("tłumaczy wartości techniczne na etykiety widoczne w aplikacji", () => {
    assert.equal(valueLabel("create_task", "priority", "MEDIUM"), "Średni");
    assert.equal(valueLabel("update_task_status", "status", "TODO"), "Do zrobienia");
    assert.equal(valueLabel("create_task", "priority", "NONE"), "Brak");
  });

  it("nieznaną wartość zwraca bez zmian (nie gubi informacji)", () => {
    assert.equal(valueLabel("create_task", "priority", "COSMOS"), "COSMOS");
  });

  it("etykietuje parametry ze wspólnego słownika, gdy kontrakt ich nie opisuje", () => {
    assert.equal(paramLabel("create_task", "title"), "Tytuł");
    assert.equal(paramLabel("add_fuel_log", "liters"), "Litry");
  });

  it("ukrywa identyfikatory rekordów przed użytkownikiem", () => {
    assert.equal(fieldSpec("update_task", "taskId", "cmrxo01jm00egksnw1ycs4dq8").control, "hidden");
    assert.equal(fieldSpec("delete_note", "noteId", "abc").control, "hidden");
  });

  it("dobiera kontrolkę do rodzaju wartości, gdy pole nie jest opisane", () => {
    assert.equal(fieldSpec("create_list", "name", "Tygodniowe").control, "text");
    assert.equal(fieldSpec("create_contact", "phone", 123).control, "number");
    assert.equal(fieldSpec("create_contact", "vip", true).control, "boolean");
    assert.equal(fieldSpec("create_vehicle", "boughtAt", "2026-07-30").control, "date");
    assert.equal(fieldSpec("create_vehicle", "seenAt", "2026-07-30T15:27:09.719Z").control, "datetime");
  });

  it("pola opisane w kontrakcie mają kontrolkę wyboru z pełną listą wartości", () => {
    const spec = fieldSpec("create_task", "priority", "MEDIUM");
    assert.equal(spec.control, "select");
    assert.equal(spec.options?.length, 5);
    assert.ok(spec.options?.some((o) => o.value === "URGENT" && o.label === "Pilne"));
  });
});

describe("actionContract — walidacja parametrów", () => {
  it("przepuszcza poprawną akcję", () => {
    assert.deepEqual(
      validateActionParams({ type: "create_task", params: { title: "Kup mleko", priority: "HIGH" } }),
      []
    );
  });

  it("odrzuca wartość spoza dozwolonego zbioru i wypisuje dopuszczalne etykiety", () => {
    const errors = validateActionParams({ type: "update_task_status", params: { status: "ALMOST_DONE" } });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /Status/);
    assert.match(errors[0], /Do zrobienia/);
  });

  it("odrzuca nieznany typ akcji", () => {
    const errors = validateActionParams({ type: "drop_database", params: {} });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /Nieznana akcja/);
  });

  it("pilnuje zakresów liczbowych", () => {
    assert.deepEqual(validateActionParams({ type: "add_expense", params: { amount: 12.5 } }), []);
    const tooLow = validateActionParams({ type: "add_expense", params: { amount: -5 } });
    assert.equal(tooLow.length, 1);
    assert.match(tooLow[0], /nie może być mniejsza niż 0/);

    const badPh = validateActionParams({ type: "log_environment", params: { ph: 99 } });
    assert.equal(badPh.length, 1);
    assert.match(badPh[0], /nie może być większa niż 14/);
  });

  it("odrzuca niepoprawną liczbę i niepoprawną datę", () => {
    assert.match(validateActionParams({ type: "add_fuel_log", params: { liters: "dużo" } })[0], /nie jest liczbą/);
    assert.match(validateActionParams({ type: "create_task", params: { dueDate: "kiedyś" } })[0], /nie jest poprawną datą/);
  });

  it("przyjmuje przecinek jako separator dziesiętny (tak wpisuje użytkownik)", () => {
    assert.deepEqual(validateActionParams({ type: "add_expense", params: { amount: "12,50" } }), []);
  });

  it("puste wartości traktuje jako brak (nie wymusza pól)", () => {
    assert.deepEqual(validateActionParams({ type: "create_task", params: { title: "X", priority: "" } }), []);
  });

  it("nie wymyśla reguł dla pól, których kontrakt nie opisuje", () => {
    assert.deepEqual(validateActionParams({ type: "create_task", params: { title: "X", cokolwiek: "abc" } }), []);
  });
});

describe("actionContract — kompletność rejestru", () => {
  it("każdy wpis ma niepustą polską etykietę", () => {
    for (const [type, contract] of Object.entries(ACTION_CONTRACTS)) {
      assert.ok(contract.label && contract.label.trim().length > 0, `brak etykiety dla ${type}`);
    }
  });

  it("każde pole wyboru ma niepustą listę wartości z etykietami", () => {
    for (const [type, contract] of Object.entries(ACTION_CONTRACTS)) {
      for (const [key, spec] of Object.entries(contract.fields ?? {})) {
        if (spec.control !== "select") continue;
        assert.ok(spec.options?.length, `${type}.${key}: pole wyboru bez wartości`);
        for (const opt of spec.options!) {
          assert.ok(opt.value.length > 0 && opt.label.length > 0, `${type}.${key}: pusta opcja`);
        }
      }
    }
  });
});
