import { signIn } from "@/lib/auth/auth-config";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden bg-bg-dark">
      {/* Decorative background glows */}
      <div className="glow-indigo top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2" />
      <div className="glow-emerald bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2" />

      <div className="glass-card max-w-md w-full p-10 rounded-2xl border border-white/10 flex flex-col items-center text-center gap-6 relative z-10">
        {/* Logo Icon */}
        <div className="w-16 h-16 rounded-full border-2 border-primary flex items-center justify-center bg-bg-dark/80 mb-2">
          <div className="w-6 h-6 rounded-full bg-primary animate-pulse" />
        </div>

        <h1 className="text-3xl font-heading font-extrabold text-white tracking-tight">
          Relay AI
        </h1>
        
        <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
          Founders do not manage static contacts. They pursue objectives. 
          Initialize your spatial relationship orbit to generate personalized outreach drafts and coordinate investor follow-ups.
        </p>

        <form
          className="w-full mt-4"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/briefing" });
          }}
        >
          <button
            type="submit"
            className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-zinc-950 font-semibold rounded-xl transition duration-200 flex items-center justify-center gap-3 cursor-pointer select-none border border-transparent active:scale-[0.98]"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.86 0 3.55.73 4.8 1.92l2.36-2.36C17.65 1.97 15.11 1 12.24 1 6.58 1 2 5.58 2 11.24s4.58 10.24 10.24 10.24c5.79 0 10.24-4.09 10.24-10.24 0-.69-.08-1.36-.21-1.96H12.24z" />
            </svg>
            Connect Google Account
          </button>
        </form>

        <div className="text-[10px] text-gray-500 font-mono mt-4">
          SECURE ENCRYPTED JWT SESSION • GMAIL API OFFICIAL INTEGRATION
        </div>
      </div>
    </div>
  );
}
