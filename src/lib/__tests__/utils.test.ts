import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getVNDateParts,
  getFilterDateRange,
  serializeData,
  toDate,
  toInstant,
  calcPercent,
  readVietnameseCurrency,
  maskAccountNumber,
  roundToHundredth,
} from "../utils";

describe("Date & Timezone Utilities (UTC+7)", () => {
  it("getVNDateParts converts UTC boundary instants accurately to UTC+7", () => {
    // 2026-10-31T17:00:00.000Z is 2026-11-01T00:00:00.000+07:00
    const startOfNovVN = getVNDateParts("2026-10-31T17:00:00.000Z");
    assert.deepEqual(startOfNovVN, { year: 2026, month: 11, day: 1 });

    // 2026-10-31T16:59:59.999Z is 2026-10-31T23:59:59.999+07:00
    const endOfOctVN = getVNDateParts("2026-10-31T16:59:59.999Z");
    assert.deepEqual(endOfOctVN, { year: 2026, month: 10, day: 31 });
  });

  it("getFilterDateRange returns exact UTC+7 month boundaries", () => {
    const range = getFilterDateRange(11, 2026);
    assert.equal(range.month, 11);
    assert.equal(range.year, 2026);
    assert.equal(range.label, "Tháng 11/2026");
    // 2026-11-01 00:00:00.000+07:00 === 2026-10-31T17:00:00.000Z
    assert.equal(range.from.toISOString(), "2026-10-31T17:00:00.000Z");
    // 2026-11-30 23:59:59.999+07:00 === 2026-11-30T16:59:59.999Z
    assert.equal(range.to.toISOString(), "2026-11-30T16:59:59.999Z");
  });

  it("getFilterDateRange handles ALL year mode in UTC+7", () => {
    const range = getFilterDateRange("ALL", 2026);
    assert.equal(range.month, "ALL");
    assert.equal(range.year, 2026);
    assert.equal(range.label, "Năm 2026");
    assert.equal(range.from.toISOString(), "2025-12-31T17:00:00.000Z");
    assert.equal(range.to.toISOString(), "2026-12-31T16:59:59.999Z");
  });

  it("toInstant and toDate round-trip Temporal.Instant safely", () => {
    const iso = "2026-05-15T08:30:00.000Z";
    const instant = toInstant(iso);
    assert.equal(typeof instant.epochMilliseconds, "number");
    const dateBack = toDate(instant);
    assert.equal(dateBack.toISOString(), iso);
  });
});

describe("Serialization & Formatting Utilities", () => {
  it("serializeData converts Temporal.Instant, Date, and BigInt recursively", () => {
    const instant = toInstant("2026-08-01T00:00:00.000Z");
    const input = {
      id: "tx_1",
      recordedAt: instant,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      bigCount: BigInt(9007199254740991),
      nested: [{ at: instant }],
    };

    const output = serializeData(input);
    assert.equal(output.recordedAt, "2026-08-01T00:00:00.000Z");
    assert.equal(output.createdAt, "2026-08-01T00:00:00.000Z");
    assert.equal(output.bigCount, "9007199254740991");
    assert.equal(output.nested[0].at, "2026-08-01T00:00:00.000Z");
  });

  it("calcPercent clamps between 0 and 100 and rounds to hundredth", () => {
    assert.equal(calcPercent(25, 100), 25);
    assert.equal(calcPercent(150, 100), 100);
    assert.equal(calcPercent(-10, 100), 0);
    assert.equal(calcPercent(1, 3), 33.33);
    assert.equal(calcPercent(50, 0), 0);
  });

  it("readVietnameseCurrency reads VND amounts in Vietnamese accurately", () => {
    assert.equal(readVietnameseCurrency(500_000), "Năm trăm nghìn đồng");
    assert.equal(readVietnameseCurrency(2_500_000), "Hai triệu năm trăm nghìn đồng");
    assert.equal(readVietnameseCurrency(0), "");
  });

  it("maskAccountNumber masks all but last 4 characters", () => {
    assert.equal(maskAccountNumber("1903456789012"), "•••• 9012");
    assert.equal(maskAccountNumber("1234"), "1234");
    assert.equal(maskAccountNumber(null), "");
  });

  it("roundToHundredth avoids floating-point drift", () => {
    assert.equal(roundToHundredth(12.3456), 12.35);
    assert.equal(roundToHundredth(1.005), 1.01);
  });
});

