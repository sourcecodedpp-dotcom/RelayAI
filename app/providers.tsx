"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import React, { useState } from "react";
import { useToastStore } from "@/lib/toast";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";

function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="p-3.5 bg-zinc-950/95 border border-zinc-800 text-white rounded-xl shadow-2xl flex items-start gap-3 pointer-events-auto transition-all duration-300 transform hover:border-zinc-700"
          style={{ animation: "scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards" }}
        >
          {t.type === "success" && <CheckCircle2 size={16} className="text-zinc-200 mt-0.5 shrink-0" />}
          {t.type === "error" && <AlertCircle size={16} className="text-zinc-400 mt-0.5 shrink-0" />}
          {t.type === "info" && <Info size={16} className="text-zinc-400 mt-0.5 shrink-0" />}
          
          <div className="flex-1 text-xs font-body leading-normal text-zinc-300">
            {t.message}
          </div>

          <button
            onClick={() => removeToast(t.id)}
            className="text-zinc-500 hover:text-zinc-300 cursor-pointer shrink-0 transition"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Create query client instance on mount to prevent sharing cache between users
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute stale time
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {children}
          <ToastContainer />
        </TooltipProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
export default Providers;
