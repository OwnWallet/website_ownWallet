---
name: pull-request-generator
description: >-
  Standardized guide and generator for creating Pull Request (PR) titles and
  descriptions in this repository following the team's official markdown template.
  Activate whenever the user asks to create, draft, format, or generate a Pull
  Request title and description, or when preparing code for review.
---

# Pull Request Title & Description Generator

This skill standardizes the creation of Pull Request titles and descriptions for the `OwnWallet` project. It ensures every PR is clean, informative, traceable, and ready for team review.

---

## 1. Pull Request Title Convention

Use the **Conventional Commits** standard in English:
`<type>(<scope>): <short summary>`

- **Types**:
  - `feat`: A new user-facing feature or enhancement.
  - `fix`: A bug fix.
  - `refactor`: Code restructuring without changing behavior.
  - `perf`: Performance optimization.
  - `chore`: Maintenance, dependencies, tooling updates.
  - `docs`: Documentation changes.
  - `style`: Formatting, missing semi colons, styling without code logic changes.
- **Scope** (optional but strongly recommended):
  - Component or feature area in lowercase: `debts`, `wallets`, `transactions`, `investments`, `reports`, `auth`, `ui`, etc.
- **Short summary**:
  - Imperative mood, lowercase first letter, no period at the end.
  - Examples:
    - `feat(debts): add independent scroll, pagination, view switcher and fix modal stacking context`
    - `fix(sidebar): prevent sticky layout overlapping on mobile screens`
    - `refactor(transactions): optimize query batching and date filtering`

---

## 2. Standard Pull Request Markdown Template

Every Pull Request description must adhere strictly to the following markdown template:

```markdown
<PR Title>

## 📌 Mô tả thay đổi
<!-- Tóm tắt ngắn gọn mục tiêu, lý do hoặc bối cảnh của Pull Request này -->

## 🛠 Loại thay đổi
<!-- Đánh dấu [x] vào các mục phù hợp -->
- [ ] 🐛 **Bug fix** (sửa lỗi hiện có)
- [ ] ✨ **Feature** (tính năng mới)
- [ ] 🎨 **UI / UX** (cải tiến giao diện, animation, responsive)
- [ ] ⚡ **Optimization** (tối ưu hiệu năng, giảm bundle size, tối ưu queries)
- [ ] 🗄️ **Database** (thay đổi `contract.prisma`, schema hoặc migration)
- [ ] 🔧 **Chore / Refactor** (dọn dẹp mã nguồn, cấu hình công cụ, dependencies)
- [ ] 📝 **Documentation** (cập nhật README, hướng dẫn thiết lập)

## 🔗 Issue liên quan
<!-- Điền issue number ví dụ: Closes #12 hoặc Relates to #45 -->
Closes #

## 🧪 Các bước kiểm tra đã thực hiện
- [ ] Đã chạy `npm run lint` không phát sinh lỗi.
- [ ] Đã chạy `npm run build` thành công trên môi trường cục bộ.
- [ ] Đã kiểm tra trực tiếp giao diện và luồng xử lý trên trình duyệt.
- [ ] Đã đảm bảo không commit thông tin bí mật (API Key, Database Secret) vào git.

## 📸 Ảnh chụp màn hình / Video demo (nếu có)
<!-- Kéo thả ảnh hoặc dán link video ngắn minh họa sự thay đổi -->
```

---

## 3. Workflow for Generating a Pull Request

When invoked to generate a PR for the current branch:

1. **Inspect Branch Context & Changes**:
   - Run `git status` and `git log -n 5 --oneline`.
   - Run `git diff --stat origin/main...HEAD` (or `develop...HEAD`) to view all modified files.
2. **Determine Categories**:
   - Check all applicable boxes (`[x]`) in `## 🛠 Loại thay đổi`.
3. **Draft Detailed Description (`## 📌 Mô tả thay đổi`)**:
   - Group changes logically (e.g. *Sửa lỗi (Bug Fixes)*, *Tính năng mới (New Features)*, *Tối ưu kỹ thuật (Refactor & Polish)*).
   - Reference specific files where important changes occurred.
4. **Verify Quality Checks (`## 🧪 Các bước kiểm tra đã thực hiện`)**:
   - Ensure `npm run lint` and `npx tsc --noEmit` have been executed and passed.
   - Check boxes that were validated during the session.
5. **Issue Linking (`## 🔗 Issue liên quan`)**:
   - If an issue was mentioned, reference `Closes #<id>`; otherwise leave as placeholder `Closes #`.
