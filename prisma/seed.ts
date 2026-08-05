import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_CATEGORIES } from "../src/lib/constants";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Xóa dữ liệu demo cũ (nếu có)
  await prisma.user.deleteMany({ where: { email: "demo@wnwallet.dev" } });

  const hashedPassword = await bcrypt.hash("demo123456", 12);

  const user = await prisma.user.create({
    data: {
      name: "Demo User",
      email: "demo@wnwallet.dev",
      password: hashedPassword,
      categories: {
        createMany: {
          data: DEFAULT_CATEGORIES,
        },
      },
    },
  });

  console.log(`✅ Created demo user: ${user.email}`);
  console.log(`   Password: demo123456`);
  console.log(`   Categories: ${DEFAULT_CATEGORIES.length} danh mục mặc định`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
