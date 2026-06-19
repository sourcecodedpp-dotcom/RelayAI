import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-config";

export default async function IndexPage() {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/briefing");
  } else {
    redirect("/login");
  }
}
