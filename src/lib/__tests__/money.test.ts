import test from "node:test";
import assert from "node:assert/strict";
import {
  toCents,
  fromCents,
  sumMoney,
  addMoney,
  subMoney,
  splitMoney,
  parseAmountString,
  formatAmountInput,
} from "../money";

test("Money: exact cent arithmetic", async (t) => {
  await t.test("toCents reads DB decimal strings exactly", () => {
    assert.equal(toCents("1234567.89"), 123456789);
    assert.equal(toCents("0.1"), 10);
    assert.equal(toCents("-5.05"), -505);
    assert.equal(toCents("100"), 10000);
    assert.equal(toCents("12.30"), 1230);
    assert.equal(toCents(12.34), 1234);
    assert.equal(toCents(null), 0);
  });
  await t.test("sums have no floating point drift", () => {
    assert.equal(0.1 + 0.2 === 0.3, false);
    assert.equal(sumMoney([0.1, 0.2]), 0.3);
    assert.equal(sumMoney(["1000000.01", "2000000.02", 0.07]), 3000000.1);
    assert.equal(addMoney(19.99, 0.01), 20);
    assert.equal(subMoney(100, 33.33), 66.67);
    assert.equal(fromCents(1), 0.01);
  });
  await t.test("splitMoney never loses a cent", () => {
    assert.deepEqual(splitMoney(100, 3), [33.33, 33.33, 33.34]);
    assert.deepEqual(splitMoney(12300000, 6), [2050000, 2050000, 2050000, 2050000, 2050000, 2050000]);
    const parts = splitMoney(1000000.01, 7);
    assert.equal(sumMoney(parts), 1000000.01);
    assert.deepEqual(splitMoney(50, 0), [50]);
  });
});

test("Money: parseAmountString keeps decimals", async (t) => {
  const v = (s: string) => parseAmountString(s)?.value;
  await t.test("Vietnamese and international separators", () => {
    assert.equal(v("1.234.567"), 1234567);
    assert.equal(v("1,234,567"), 1234567);
    assert.equal(v("1.234.567,89"), 1234567.89);
    assert.equal(v("1,234,567.89"), 1234567.89);
    assert.equal(v("100,5"), 100.5);
    assert.equal(v("1234.56"), 1234.56);
    assert.equal(v("1.234"), 1234);
    assert.equal(v("500000"), 500000);
    assert.equal(v("12.345 VND"), 12345);
    assert.equal(v("0,01"), 0.01);
  });
  await t.test("signs and credit markers", () => {
    assert.deepEqual(parseAmountString("-50.000"), { value: 50000, negative: true, credit: false });
    assert.deepEqual(parseAmountString("(250.000)"), { value: 250000, negative: true, credit: false });
    assert.deepEqual(parseAmountString("1.500.000 CR"), { value: 1500000, negative: false, credit: true });
    assert.deepEqual(parseAmountString("+2.000,50"), { value: 2000.5, negative: false, credit: false });
  });
  await t.test("rejects non-amounts", () => {
    assert.equal(parseAmountString("abc"), null);
    assert.equal(parseAmountString("12/09/2026"), null);
    assert.equal(parseAmountString("1.23.4"), null);
    assert.equal(parseAmountString(""), null);
  });
});

test("Money: input display", () => {
  assert.equal(formatAmountInput(1234567.5), "1.234.567,5");
  assert.equal(formatAmountInput(1234567.05), "1.234.567,05");
  assert.equal(formatAmountInput(1000), "1.000");
  assert.equal(formatAmountInput(0.1 + 0.2), "0,3");
  assert.equal(formatAmountInput(0), "");
});
