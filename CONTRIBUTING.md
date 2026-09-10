# Hướng Dẫn Đóng Góp (Contributing Guidelines)

Cảm ơn bạn đã quan tâm và muốn đóng góp cho **OwnWallet**! Tài liệu này cung cấp quy trình và tiêu chuẩn để giúp việc cộng tác diễn ra nhanh chóng, rõ ràng và hiệu quả.

---

## 1. Quy Trình Làm Việc Với Git (Git Workflow)

### A. Quy ước đặt tên nhánh (Branch Naming)
Mọi nhánh mới nên được rẽ từ nhánh `develop` (hoặc `main` nếu triển khai trực tiếp) với tiền tố chuẩn:

- `feat/<tên-tính-năng>`: Thêm tính năng mới (Ví dụ: `feat/recurring-transactions`)
- `fix/<tên-lỗi>`: Khắc phục lỗi (Ví dụ: `fix/currency-input-formatting`)
- `refactor/<khu-vực>`: Tái cấu trúc code (Ví dụ: `refactor/reports-chart`)
- `docs/<chủ-đề>`: Cập nhật tài liệu (Ví dụ: `docs/api-documentation`)
- `chore/<mục-đích>`: Công việc bảo trì, cấu hình (Ví dụ: `chore/setup-github-standards`)

### B. Quy ước Commit (Conventional Commits)
Thông điệp commit cần ngắn gọn, rõ ràng theo chuẩn:
```
<type>(<scope>): <mô tả ngắn gọn bằng tiếng Anh hoặc tiếng Việt>
```
**Các type thông dụng:**
- `feat`: Tính năng mới
- `fix`: Sửa lỗi
- `docs`: Tài liệu
- `style`: Định dạng code, spacing, không ảnh hưởng logic
- `refactor`: Tái cấu trúc không thêm tính năng, không sửa lỗi
- `perf`: Cải thiện hiệu năng
- `test`: Thêm hoặc sửa test
- `chore`: Cấu hình build, dependencies

*Ví dụ:* `feat(wallet): thêm bộ chọn ví mặc định` hoặc `fix(auth): xử lý lỗi callback google oauth`

---

## 2. Thiết Lập Môi Trường Phát Triển Cục Bộ

1. **Yêu cầu môi trường:**
   - Node.js: v20+ (Khuyến nghị v20 LTS hoặc v22 LTS)
   - Trình quản lý gói: `npm`
   - Cơ sở dữ liệu: PostgreSQL (local hoặc cloud như Neon / Supabase / Prisma Accelerate)

2. **Cài đặt thư viện:**
   ```bash
   npm install
   ```
   *(Lệnh này tự động kích hoạt `postinstall` để sinh prisma contract)*

3. **Cấu hình biến môi trường:**
   - Sao chép file mẫu:
     ```bash
     cp .env.example .env
     ```
   - Điền các giá trị thực tế (`DATABASE_URL`, `AUTH_SECRET`, `GEMINI_API_KEY`,...).

4. **Khởi động ứng dụng:**
   ```bash
   npm run dev
   ```
   Truy cập tại: [http://localhost:3000](http://localhost:3000)

---

## 3. Lưu Ý Về Công Nghệ Đặc Thù

- **Prisma 8 (Prisma Next):**
  - Không chỉnh sửa file `schema.prisma` truyền thống. Dự án dùng **`prisma/contract.prisma`** (PSL v2).
  - Khởi tạo lại TypeScript contract sau khi sửa model: `npm run db:emit`.
  - Cập nhật database: `npm run db:migrate` (hoặc `npm run db:apply`).
- **Next.js 16 App Router & Server Actions:**
  - Hạn chế tạo API route thủ công nếu có thể xử lý trực tiếp qua Server Actions trong `src/app/(app)/...`.
- **Bảo mật:**
  - Tuyệt đối **không** commit file `.env`, `.env.local` hoặc các API key bí mật vào git.

---

## 4. Checklist Trước Khi Tạo Pull Request (PR)

Trước khi gửi PR lên GitHub, hãy đảm bảo:
- [ ] Chạy lệnh kiểm tra code: `npm run lint` (không còn lỗi nghiêm trọng).
- [ ] Kiểm tra type & build: `npm run build` chạy thành công.
- [ ] Điền đầy đủ thông tin theo mẫu **Pull Request Template** được cung cấp sẵn.
- [ ] Liên kết với Issue tương ứng (nếu có) bằng từ khóa `Closes #issue_number`.
