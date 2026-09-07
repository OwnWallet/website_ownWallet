import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getWallets } from "@/actions/wallets";
import { WalletsClient } from "./wallets-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quản lý Tài khoản — OwnWallet",
  description: "Quản lý các tài khoản ngân hàng (TPBank, Techcombank...) và theo dõi số dư thực tế.",
};

export default async function WalletsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [wallets, unassignedTxs] = await Promise.all([
    getWallets(),
    db.orm.public.Transaction
      .where({ userId, walletId: null })
      .all(),
  ]);

  return (
    <WalletsClient
      initialWallets={wallets}
      unassignedCount={unassignedTxs.length}
    />
  );
}
