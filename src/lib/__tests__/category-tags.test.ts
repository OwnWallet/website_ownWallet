import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CATEGORIES,
  CATEGORY_TAGS,
  getCategoryTags,
  extractTagFromNote,
  getAllTags,
  formatTransactionNote,
  parseTransactionNote,
  aggregateTagSpending,
} from "../constants";
import { classifyCategoryByKeywords } from "../ai/localStatementParser";

describe("Financial Categories & Detailed Tags", () => {
  it("DEFAULT_CATEGORIES bao gồm đầy đủ 26 danh mục chuẩn", () => {
    assert.equal(DEFAULT_CATEGORIES.length, 26);
    const names = DEFAULT_CATEGORIES.map((c) => c.name);
    // Các danh mục bổ sung mới
    assert.ok(names.includes("Nhà ở & Tiền trọ"));
    assert.ok(names.includes("Giáo dục & Học tập"));
    assert.ok(names.includes("Làm đẹp & Bản thân"));
    assert.ok(names.includes("Bảo hiểm"));
    assert.ok(names.includes("Từ thiện & Quà tặng"));
    assert.ok(names.includes("Hỗ trợ & Trợ cấp"));
    assert.ok(names.includes("Lợi tức đầu tư"));
    assert.ok(names.includes("Bất động sản"));

    // Mỗi danh mục phải có màu, icon và type hợp lệ
    for (const cat of DEFAULT_CATEGORIES) {
      assert.ok(cat.name.length > 0);
      assert.ok(cat.icon.length > 0);
      assert.match(cat.color, /^#([0-9a-fA-F]{3}){1,2}$/);
      assert.ok(["EXPENSE", "INCOME", "INVEST", "DEBT", "SAVINGS"].includes(cat.type));
    }
  });

  it("100% danh mục trong DEFAULT_CATEGORIES đều có danh sách tag chi tiết trong CATEGORY_TAGS", () => {
    for (const cat of DEFAULT_CATEGORIES) {
      const tags = CATEGORY_TAGS[cat.name];
      assert.ok(Array.isArray(tags), `Danh mục "${cat.name}" thiếu tag trong CATEGORY_TAGS`);
      assert.ok(tags.length >= 4, `Danh mục "${cat.name}" cần ít nhất 4 tag chi tiết`);
    }
  });

  it("getCategoryTags hỗ trợ tên chính xác, không dấu, viết hoa/thường", () => {
    const foodTags = getCategoryTags("Ăn uống");
    assert.ok(foodTags.includes("Bánh mì"));
    assert.ok(foodTags.includes("Cà phê"));

    // Không dấu
    const unaccented = getCategoryTags("an uong");
    assert.deepEqual(unaccented, foodTags);

    // Chữ hoa
    const uppercase = getCategoryTags("ĂN UỐNG");
    assert.deepEqual(uppercase, foodTags);

    // Danh mục mới: Nhà ở
    const houseTags = getCategoryTags("Nhà ở & Tiền trọ");
    assert.ok(houseTags.includes("Tiền trọ"));
    assert.ok(houseTags.includes("Tiền cọc phòng"));

    // Fallback cho danh mục không tồn tại trả về tag phổ biến
    const fallback = getCategoryTags("Danh mục lạ hoắc");
    assert.ok(fallback.length > 0);
    assert.ok(fallback.includes("Cà phê"));
  });

  it("extractTagFromNote trích xuất đúng tag định dạng [Tag] hoặc từ diễn giải", () => {
    // 1. Tag [Tag] người dùng gán
    assert.equal(extractTagFromNote("[Cà phê] Gặp bạn bè"), "Cà phê");
    assert.equal(extractTagFromNote("[Bánh mì] Ăn sáng"), "Bánh mì");

    // Bỏ qua tag hệ thống
    assert.equal(extractTagFromNote("[tx_id:12345] Ghi chú"), null);
    assert.equal(extractTagFromNote("[SCHEDULE:{\"due\":\"2026-12-01\"}]"), null);
    assert.equal(extractTagFromNote("[Người: Phan Hoàng Quân]"), null);
    assert.equal(extractTagFromNote("[Đã vào sổ nợ]"), null);

    // 2. Trích xuất tag từ diễn giải theo ngữ cảnh danh mục
    assert.equal(
      extractTagFromNote("Phan Hoang Nhat chuyen tien bun bo giò heo", "Ăn uống"),
      "Bún bò"
    );
    assert.equal(
      extractTagFromNote("Đổ xăng tại cây xăng Nguyễn Hữu Thọ", "Di chuyển"),
      "Đổ xăng"
    );
    assert.equal(
      extractTagFromNote("Thanh toán tiền điện tháng 10 EVN", "Hóa đơn"),
      "Tiền điện"
    );
    assert.equal(
      extractTagFromNote("Chuyển tiền trọ phòng 402", "Nhà ở & Tiền trọ"),
      "Tiền trọ"
    );
    assert.equal(
      extractTagFromNote("Cắt tóc Đông Tây Barber", "Làm đẹp & Bản thân"),
      "Cắt tóc"
    );
  });

  it("getAllTags trả về danh sách tag không trùng lặp và có trên 150 tag", () => {
    const all = getAllTags();
    assert.ok(all.length >= 150);
    const unique = new Set(all);
    assert.equal(unique.size, all.length);
  });

  it("formatTransactionNote và parseTransactionNote hoạt động 2 chiều chính xác độc lập với miêu tả", () => {
    // 1. Chỉ có tag
    const note1 = formatTransactionNote({ tag: "Cà phê" });
    assert.equal(note1, "[Tag: Cà phê]");
    const parsed1 = parseTransactionNote(note1);
    assert.equal(parsed1.tag, "Cà phê");
    assert.equal(parsed1.description, "");
    assert.equal(parsed1.debtPerson, null);

    // 2. Có tag và miêu tả riêng
    const note2 = formatTransactionNote({ tag: "Xăng xe", description: "Đổ xăng Petrolimex Nguyễn Tri Phương" });
    assert.equal(note2, "[Tag: Xăng xe] Đổ xăng Petrolimex Nguyễn Tri Phương");
    const parsed2 = parseTransactionNote(note2);
    assert.equal(parsed2.tag, "Xăng xe");
    assert.equal(parsed2.description, "Đổ xăng Petrolimex Nguyễn Tri Phương");
    assert.equal(parsed2.debtPerson, null);

    // 3. Có cả tag, đối tác nợ và miêu tả
    const note3 = formatTransactionNote({
      tag: "Cơm trưa",
      debtPerson: "Nguyễn Văn A",
      description: "Ăn trưa liên hoan team",
    });
    assert.equal(note3, "[Tag: Cơm trưa] [Người: Nguyễn Văn A] Ăn trưa liên hoan team");
    const parsed3 = parseTransactionNote(note3);
    assert.equal(parsed3.tag, "Cơm trưa");
    assert.equal(parsed3.debtPerson, "Nguyễn Văn A");
    assert.equal(parsed3.description, "Ăn trưa liên hoan team");

    // 4. Dọn sạch các system tags khác mà không làm mất miêu tả
    const note4 = "[Tag: Tiền trọ] [tx_id:abc1234] [Đã vào sổ nợ] Tiền phòng tháng 10";
    const parsed4 = parseTransactionNote(note4);
    assert.equal(parsed4.tag, "Tiền trọ");
    assert.equal(parsed4.description, "Tiền phòng tháng 10");

    // 5. Tự động nhận diện tag từ diễn giải cũ nếu chưa có tag tường minh
    const noteLegacy = "Uống trà sữa Gongcha với bạn";
    const parsedLegacy = parseTransactionNote(noteLegacy, "Ăn uống");
    assert.equal(parsedLegacy.tag, "Trà sữa");
    assert.equal(parsedLegacy.description, "Uống trà sữa Gongcha với bạn");
  });

  it("aggregateTagSpending tổng hợp và xếp hạng chi tiêu theo tag chính xác", () => {
    const transactions = [
      {
        type: "EXPENSE",
        amount: 50000,
        note: "[Tag: Cà phê] Highlands",
        category: { name: "Ăn uống", color: "#f97316" },
      },
      {
        type: "EXPENSE",
        amount: 45000,
        note: "[Tag: Cà phê] Phúc Long",
        category: { name: "Ăn uống", color: "#f97316" },
      },
      {
        type: "EXPENSE",
        amount: 80000,
        note: "[Tag: Xăng xe] Đổ xăng",
        category: { name: "Di chuyển", color: "#eab308" },
      },
      {
        type: "EXPENSE",
        amount: 25000,
        note: "Bánh tráng nướng", // Nhận diện ngầm tag hoặc Chưa gắn tag
        category: { name: "Ăn uống", color: "#f97316" },
      },
      {
        type: "INCOME", // Phải bỏ qua thu nhập
        amount: 10000000,
        note: "Lương tháng",
        category: { name: "Lương", color: "#22c55e" },
      },
    ];

    const totalExpense = 200000;
    const aggregated = aggregateTagSpending(transactions, totalExpense);

    assert.ok(aggregated.length > 0);
    // Cà phê: 50k + 45k = 95k (lớn nhất)
    assert.equal(aggregated[0].name, "Cà phê");
    assert.equal(aggregated[0].value, 95000);
    assert.equal(aggregated[0].count, 2);
    assert.equal(aggregated[0].categoryName, "Ăn uống");
    assert.equal(aggregated[0].percentage, Math.round((95000 / 200000) * 100)); // 48%

    // Xăng xe: 80k (thứ hai)
    assert.equal(aggregated[1].name, "Xăng xe");
    assert.equal(aggregated[1].value, 80000);
    assert.equal(aggregated[1].count, 1);
    assert.equal(aggregated[1].categoryName, "Di chuyển");
    assert.equal(aggregated[1].percentage, 40);

    // Thứ hạng phải được sắp xếp giảm dần theo value
    for (let i = 0; i < aggregated.length - 1; i++) {
      assert.ok(aggregated[i].value >= aggregated[i + 1].value);
    }
  });
});

describe("Local Statement Parser with Expanded Categories", () => {
  const catNames = DEFAULT_CATEGORIES.map((c) => c.name);

  it("phân loại đúng các danh mục mới từ diễn giải thực tế", () => {
    // Nhà ở & Tiền trọ
    const tro = classifyCategoryByKeywords("PHAN HOANG NHAT phong 402 tien coc va tien o", "EXPENSE", catNames);
    assert.equal(tro.categoryName, "Nhà ở & Tiền trọ");

    // Giáo dục & Học tập
    const udemy = classifyCategoryByKeywords("chuyen tien mua tai khoan hoc udemy", "EXPENSE", catNames);
    assert.equal(udemy.categoryName, "Giáo dục & Học tập");

    // Làm đẹp & Bản thân
    const barber = classifyCategoryByKeywords("Cắt tóc Đông Tây Barber", "EXPENSE", catNames);
    assert.equal(barber.categoryName, "Làm đẹp & Bản thân");

    // Bảo hiểm
    const baohiem = classifyCategoryByKeywords("Phan Hoang Nhat chuyen tien bao hiem xe may", "EXPENSE", catNames);
    assert.equal(baohiem.categoryName, "Bảo hiểm");

    // Hỗ trợ & Trợ cấp
    const hotro = classifyCategoryByKeywords("me chuyen tien sinh hoat thang 10", "INCOME", catNames);
    assert.equal(hotro.categoryName, "Hỗ trợ & Trợ cấp");

    // Chứng khoán
    const ck = classifyCategoryByKeywords("Nap tien vps chung khoan", "EXPENSE", catNames);
    assert.equal(ck.categoryName, "Chứng khoán");
  });
});
