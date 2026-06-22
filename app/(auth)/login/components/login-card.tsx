"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface LoginCardProps {
  signInAction: () => Promise<void>;
}

export default function LoginCard({ signInAction }: LoginCardProps) {
  return (
    <div className="relative min-h-screen w-full bg-black flex items-center justify-center p-6 select-none text-zinc-400 font-body">
      
      {/* Subtle ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-zinc-900/10 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-[360px]"
      >
        <div className="flex flex-col items-center gap-7">

          {/* Typography */}
          <div className="space-y-1.5 text-center">
            <h1 className="text-xl font-medium tracking-tight text-white font-heading">
              Sign in to Relay
            </h1>
            <p className="text-xs text-zinc-500">
              to continue to your workspace
            </p>
          </div>

          {/* Google Sign-in Action */}
          <form action={signInAction} className="w-full">
            <Button
              type="submit"
              variant="outline"
              className="w-full h-11 text-xs font-medium tracking-wide bg-zinc-950 text-white border-zinc-800 hover:bg-zinc-900 hover:text-white transition-colors flex items-center justify-center gap-3 rounded-lg cursor-pointer"
            >
              {/* Official Colored Google Logo SVG */}
              <svg className="size-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continue with Google</span>
            </Button>
          </form>

          {/* Single simple footer notice */}
          <p className="text-[10px] text-zinc-600 text-center max-w-[200px] leading-relaxed">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
