import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-config";
import Sidebar from "@/components/sidebar";

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

  return (
    <div className="flex h-screen bg-bg-dark text-gray-200 overflow-hidden w-full">
      <Sidebar />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <main className="flex-1 overflow-y-auto relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
