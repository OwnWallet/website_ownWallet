import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CATEGORIES,
  CATEGORY_TAGS,
  getCategoryTags,
  extractTagFromNote,
  getAllTags,
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
