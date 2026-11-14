import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeText,
  extractMerchantKey,
  findMatchingRule,
  applyCategoryRules,
  collectCorrections,
  type CategoryRule,
} from "../category-rules";

describe("normalizeText / extractMerchantKey", () => {
  it("bỏ dấu, viết hoa, bỏ ký tự đặc biệt", () => {
    assert.equal(normalizeText("Cà phê Highlands - Q.1"), "CA PHE HIGHLANDS Q 1");
    assert.equal(normalizeText("Điện lực"), "DIEN LUC");
  });

  it("lấy từ khóa người bán, bỏ từ nhiễu & mã giao dịch", () => {
    assert.equal(extractMerchantKey("TT QR HIGHLANDS COFFEE Q1 FT26321123"), "HIGHLANDS COFFEE");
    assert.equal(extractMerchantKey("GRAB*TRIP 123456"), "GRAB TRIP");
    assert.equal(extractMerchantKey("Thanh toán Điện lực TPHCM"), "DIEN LUC");
    assert.equal(extractMerchantKey("[Người: Tuấn] SHOPEE PAY ORDER 99"), "SHOPEE");
    assert.equal(extractMerchantKey("Thanh toan luc 10:30 tai CIRCLE K"), "CIRCLE");
  });

  it("trả null khi không có từ khóa đáng tin", () => {
    assert.equal(extractMerchantKey("CK 123456 FT2632"), null);
    assert.equal(extractMerchantKey(""), null);
    assert.equal(extractMerchantKey(null), null);
    assert.equal(extractMerchantKey("Chuyển tiền"), null);
  });
});

const rules: CategoryRule[] = [
  { id: "1", keyword: "GRAB", txType: "EXPENSE", categoryId: "c-move", hits: 3 },
  { id: "2", keyword: "GRAB FOOD", txType: "EXPENSE", categoryId: "c-food", hits: 1 },
  { id: "3", keyword: "HIGHLANDS COFFEE", txType: "EXPENSE", categoryId: "c-deleted", hits: 5 },
  { id: "4", keyword: "LUONG", txType: "INCOME", categoryId: "c-salary", hits: 2 },
];

describe("findMatchingRule", () => {
  it("ưu tiên từ khóa dài nhất và đúng loại thu/chi", () => {
    assert.equal(findMatchingRule("GRAB*FOOD ORDER", "EXPENSE", rules)?.id, "2");
    assert.equal(findMatchingRule("GRAB TRIP HCM", "EXPENSE", rules)?.id, "1");
    assert.equal(findMatchingRule("GRAB TRIP HCM", "INCOME", rules), null);
  });

  it("chỉ khớp trọn từ (không khớp một phần từ)", () => {
    assert.equal(findMatchingRule("GRABBER SHOP", "EXPENSE", rules), null);
    assert.equal(findMatchingRule("Lương tháng 10", "INCOME", rules)?.id, "4");
  });
});

describe("applyCategoryRules", () => {
  const names = new Map([
    ["c-move", "Di chuyển"],
    ["c-food", "Ăn uống"],
    ["c-salary", "Lương"],
  ]);

  it("gán danh mục theo quy tắc, bỏ qua quy tắc trỏ tới danh mục đã xóa", () => {
    const { transactions, appliedCount } = applyCategoryRules(
      [
        { note: "GRAB*FOOD 1", type: "EXPENSE" as const, categoryName: "Mua sắm", confidence: 0.7 },
        { note: "HIGHLANDS COFFEE Q1", type: "EXPENSE" as const, categoryName: "Ăn uống", confidence: 0.9 },
        { note: "SHOPEE", type: "EXPENSE" as const, categoryName: "Mua sắm", confidence: 0.8 },
      ],
      rules,
      names
    );
    assert.equal(appliedCount, 1);
    assert.equal(transactions[0].categoryName, "Ăn uống");
    assert.equal(transactions[0].categorySource, "rule");
    assert.equal(transactions[0].suggestedCategoryName, "Ăn uống");
    assert.equal(transactions[1].categorySource, undefined);
    assert.equal(transactions[1].suggestedCategoryName, "Ăn uống");
    assert.equal(transactions[2].suggestedCategoryName, "Mua sắm");
  });
});

describe("collectCorrections", () => {
  it("chỉ học các dòng người dùng đã sửa, lấy lựa chọn cuối cùng", () => {
    const learned = collectCorrections([
      { note: "SHOPEE PAY 1", type: "EXPENSE", categoryName: "Mua sắm", suggestedCategoryName: "Ăn uống" },
      { note: "SHOPEE PAY 2", type: "EXPENSE", categoryName: "Giải trí", suggestedCategoryName: "Ăn uống" },
      { note: "GRAB TRIP", type: "EXPENSE", categoryName: "Di chuyển", suggestedCategoryName: "Di chuyển" },
      { note: "CK 1234", type: "EXPENSE", categoryName: "Khác", suggestedCategoryName: "Ăn uống" },
      { note: "OLD PAYLOAD", type: "EXPENSE", categoryName: "Khác" },
    ]);
    assert.deepEqual(learned, [{ keyword: "SHOPEE", txType: "EXPENSE", categoryName: "Giải trí" }]);
  });
});
