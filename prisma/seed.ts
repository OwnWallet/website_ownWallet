import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { DEFAULT_CATEGORIES } from "../src/lib/constants";

async function main() {
  console.log("🌱 Seeding database...");

  // Xóa dữ liệu demo cũ (nếu có)
  const existing = await db.orm.public.User.where({ email: "demo@wnwallet.dev" }).first();
  if (existing) {
    await db.orm.public.User.where({ id: existing.id }).delete();
  }

  const hashedPassword = await bcrypt.hash("demo123456", 12);

  await db.transaction(async (tx: any) => {
    const user = await tx.orm.public.User.create({
      name: "Demo User",
      email: "demo@wnwallet.dev",
      password: hashedPassword,
    });

    for (const cat of DEFAULT_CATEGORIES) {
      await tx.orm.public.Category.create({
        ...cat,
        userId: user.id,
      });
    }

    console.log(`✅ Created demo user: ${user.email}`);
    console.log(`   Password: demo123456`);
    console.log(`   Categories: ${DEFAULT_CATEGORIES.length} danh mục mặc định`);
  });
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.close?.();
  });

