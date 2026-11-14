import { db } from "../src/lib/db";
import { DEFAULT_CATEGORIES } from "../src/lib/constants";

async function main() {
  console.log("🚀 Starting backfill of default categories for existing users...");

  const users = await db.orm.public.User.all();
  console.log(`Found ${users.length} users in database.`);

  let totalAdded = 0;

  for (const user of users) {
    const existingCats = await db.orm.public.Category.where(c => c.userId.eq(user.id)).all();
    const existingNames = new Set(existingCats.map(c => c.name.trim().toLowerCase()));

    const toCreate = DEFAULT_CATEGORIES.filter(
      defCat => !existingNames.has(defCat.name.trim().toLowerCase())
    );

    if (toCreate.length > 0) {
      console.log(`User ${user.email || user.id}: Adding ${toCreate.length} missing categories...`);
      for (const cat of toCreate) {
        await db.orm.public.Category.create({
          name: cat.name,
          type: cat.type,
          color: cat.color,
          icon: cat.icon,
          isDefault: true,
          userId: user.id,
        });
        totalAdded++;
      }
    } else {
      console.log(`User ${user.email || user.id}: All ${DEFAULT_CATEGORIES.length} default categories already present.`);
    }
  }

  console.log(`✅ Backfill complete! Added ${totalAdded} category records.`);
}

main()
  .catch((e) => {
    console.error("❌ Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.close?.();
    process.exit(0);
  });
