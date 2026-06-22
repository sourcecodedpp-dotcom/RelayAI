import { signIn } from "@/lib/auth/auth-config";
import LoginCard from "./components/login-card";

export default function LoginPage() {
  const handleSignIn = async () => {
    "use server";
    await signIn("google", { redirectTo: "/" });
  };

  return <LoginCard signInAction={handleSignIn} />;
}
