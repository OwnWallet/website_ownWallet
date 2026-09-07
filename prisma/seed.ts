import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { DEFAULT_CATEGORIES } from "../src/lib/constants";

async function main() {
  console.log("🌱 Seeding database...");

  // Xóa dữ liệu demo cũ (nếu có)
  const existingOld = await db.orm.public.User.where({ email: "demo@wnwallet.dev" }).first();
  if (existingOld) {
    await db.orm.public.User.where({ id: existingOld.id }).delete();
  }
  const existing = await db.orm.public.User.where({ email: "demo@ownwallet.dev" }).first();
  if (existing) {
    await db.orm.public.User.where({ id: existing.id }).delete();
  }

  const hashedPassword = await bcrypt.hash("demo123456", 12);

  await db.transaction(async (tx: any) => {
    const user = await tx.orm.public.User.create({
      name: "Demo User",
      email: "demo@ownwallet.dev",
      password: hashedPassword,
    });

    for (const cat of DEFAULT_CATEGORIES) {
      await tx.orm.public.Category.create({
        ...cat,
        userId: user.id,
      });
    }

    // Seed 3 default wallets: 2 TPBank + 1 Techcombank
    const defaultWallets = [
      {
        name: "TPBank - TK 1",
        bankName: "TPBank",
        accountNumber: "",
        balance: "0",
        color: "#7c3aed",
        icon: "Landmark",
        isDefault: true,
        userId: user.id,
      },
      {
        name: "TPBank - TK 2",
        bankName: "TPBank",
        accountNumber: "",
        balance: "0",
        color: "#a855f7",
        icon: "CreditCard",
        isDefault: false,
        userId: user.id,
      },
      {
        name: "Techcombank",
        bankName: "Techcombank",
        accountNumber: "",
        balance: "0",
        color: "#ef4444",
        icon: "Building2",
        isDefault: false,
        userId: user.id,
      },
    ];

    for (const w of defaultWallets) {
      await tx.orm.public.Wallet.create(w);
    }

    console.log(`✅ Created demo user: ${user.email}`);
    console.log(`   Password: demo123456`);
    console.log(`   Categories: ${DEFAULT_CATEGORIES.length} danh mục mặc định`);
    console.log(`   Wallets: 3 tài khoản ngân hàng mặc định (2 TPBank + 1 Techcombank)`);
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

