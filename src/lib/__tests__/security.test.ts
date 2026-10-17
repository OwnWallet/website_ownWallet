import test from "node:test";
import assert from "node:assert/strict";
import { BudgetSchema } from "../../schemas/budget";
import { SyncItemConfigSchema, SyncTransactionsAdvancedSchema } from "../../schemas/debt";

test("Security & Schema Validation: BudgetSchema", async (t) => {
  await t.test("accepts CUIDv2 categoryId", () => {
    // Prisma 8 generates 24-character CUIDv2
    const cuidV2 = "clq1a2b3c4d5e6f7g8h9i0jk";
    const result = BudgetSchema.safeParse({
      categoryId: cuidV2,
      limitAmount: 5000000,
      month: 10,
      year: 2026,
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.categoryId, cuidV2);
      assert.equal(result.data.limitAmount, 5000000);
    }
  });

  await t.test("rejects empty categoryId", () => {
    const result = BudgetSchema.safeParse({
      categoryId: "",
      limitAmount: 5000000,
      month: 10,
      year: 2026,
    });
    assert.equal(result.success, false);
  });

  await t.test("rejects negative or zero limitAmount", () => {
    const zeroRes = BudgetSchema.safeParse({
      categoryId: "cat_123",
      limitAmount: 0,
      month: 10,
      year: 2026,
    });
    assert.equal(zeroRes.success, false);

    const negRes = BudgetSchema.safeParse({
      categoryId: "cat_123",
      limitAmount: -1000,
      month: 10,
      year: 2026,
    });
    assert.equal(negRes.success, false);
  });
});

test("Security & Schema Validation: SyncItemConfigSchema & SyncTransactionsAdvancedSchema", async (t) => {
  await t.test("accepts valid sync item configurations", () => {
    const validItems = [
      {
        txId: "tx_01",
        actionType: "CREATE",
        person: "Nguyễn Văn A",
        direction: "OWE",
      },
      {
        txId: "tx_02",
        actionType: "MERGE",
        person: "Trần Thị B",
        direction: "OWED",
        targetDebtId: "debt_99",
      },
      {
        txId: "tx_03",
        actionType: "PAYMENT",
        person: "Trần Thị B",
        direction: "OWED",
        targetDebtId: "debt_99",
      },
    ];

    const result = SyncTransactionsAdvancedSchema.safeParse(validItems);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.length, 3);
    }
  });

  await t.test("rejects empty array", () => {
    const result = SyncTransactionsAdvancedSchema.safeParse([]);
    assert.equal(result.success, false);
  });

  await t.test("rejects invalid actionType", () => {
    const item = {
      txId: "tx_01",
      actionType: "INVALID_ACTION",
      person: "A",
      direction: "OWE",
    };
    const result = SyncItemConfigSchema.safeParse(item);
    assert.equal(result.success, false);
  });

  await t.test("rejects empty txId", () => {
    const item = {
      txId: "",
      actionType: "CREATE",
      person: "A",
      direction: "OWE",
    };
    const result = SyncItemConfigSchema.safeParse(item);
    assert.equal(result.success, false);
  });
});
