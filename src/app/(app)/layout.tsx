import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getWallets } from "@/actions/wallets";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const email = session.user.email ?? "";
  const initials = email.slice(0, 2).toUpperCase();

  let wallets: any[] = [];
  try {
    wallets = await getWallets();
  } catch (err) {
    console.error("Failed to fetch wallets in layout:", err);
  }

  return (
    <AppShell email={email} initials={initials} wallets={wallets}>
      {children}
    </AppShell>
  );
}

