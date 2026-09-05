import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const email = session.user.email ?? "";
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <AppShell email={email} initials={initials}>
      {children}
    </AppShell>
  );
}

