import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-config";
import LayoutClient from "./layout-client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Route Guard: enforce authentication
  if (!session?.user?.id) {
    redirect("/login");
  }

  return <LayoutClient>{children}</LayoutClient>;
}
