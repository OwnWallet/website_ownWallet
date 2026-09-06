import "dotenv/config";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";

// Prisma 8 — dùng definePrismaConfig + @prisma/orm-postgres/config
// CLI đọc file .env nhờ dotenv/config ở trên
export default definePrismaConfig({
  orm: ormConfig({
    contract: "./prisma/contract.prisma",
    db: {
      connection: process.env.DATABASE_URL!,
    },
  }),
});
