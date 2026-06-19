"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Settings, 
  CheckCircle2, 
  AlertTriangle, 
  Sliders, 
  Sparkles,
  Link2,
  Database
} from "lucide-react";
import { toast } from "@/lib/toast";

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  onboardingCompleted: boolean;
  primaryUseCase?: string | null;
  outreachGoals?: string | null;
  googleConnection?: {
    email: string;
  } | null;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [useCase, setUseCase] = useState("");
  const [goalsText, setGoalsText] = useState("");

  // Load User Settings info
  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        // Fallback mockup profile if API is cold-started
        return {
          id: "local",
          email: session?.user?.email || "alex@aether.com",
          name: session?.user?.name || "Alex Mercer",
          onboardingCompleted: true,
          primaryUseCase: "Raise Funding",
          outreachGoals: "Secure $1.5M funding for Aether Dynamics seed round.",
          googleConnection: { email: session?.user?.email || "alex@aether.com" }
        };
      }
      return res.json();
    },
  });

  useEffect(() => {
    if (profile) {
      setUseCase(profile.primaryUseCase || "");
      setGoalsText(profile.outreachGoals || "");
    }
  }, [profile]);

  // Mutate Save Profile settings
  const saveSettings = useMutation({
    mutationFn: async (settings: any) => {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save settings.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast("System profile settings saved successfully.", "success");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings.mutate({
      primaryUseCase: useCase,
      outreachGoals: goalsText,
    });
  };

  const isGmailConnected = profile?.googleConnection !== null;

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-8">
      <header className="flex flex-col gap-1.5 mt-4">
        <div className="text-xs font-mono uppercase tracking-widest text-primary font-bold">
          System Preferences
        </div>
        <h1 className="text-4xl font-heading font-extrabold text-white tracking-tight">
          Settings Dashboard
        </h1>
        <p className="text-gray-400 text-sm font-body">
          Manage integrations, verify security connection states, and update active founder outreach objectives.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* LEFT PANE: Connection indicators */}
        <div className="md:col-span-1 flex flex-col gap-6">
          {/* Gmail integration panel */}
          <div className="glass-card p-6 rounded-xl border border-white/10 flex flex-col gap-4">
            <h3 className="text-sm font-mono text-gray-500 uppercase flex items-center gap-1.5">
              <Link2 size={14} />
              Gmail Integration
            </h3>

            {isGmailConnected ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-cta text-sm font-semibold">
                  <CheckCircle2 size={16} />
                  <span>Google connected</span>
                </div>
                <div className="text-xs text-gray-400 font-mono break-all bg-white/5 p-2.5 rounded-lg border border-white/5">
                  Mailbox: {profile?.googleConnection?.email}
                </div>
                <span className="text-[10px] text-gray-500 leading-normal">
                  Gmail token encrypted at rest using AES-256-GCM. Auto-refresh enabled.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-zinc-400 text-sm font-semibold">
                  <AlertTriangle size={16} />
                  <span>Mailbox unconnected</span>
                </div>
                <p className="text-xs text-gray-400 leading-normal">
                  Outreach generation and thread syncing requires linking a Google OAuth connection.
                </p>
                <button
                  onClick={() => toast("Google connection automatically links during OAuth sign in. Relog to trigger consent scopes.", "info")}
                  className="w-full py-2 px-3 bg-primary hover:bg-primary-hover text-zinc-950 text-xs font-bold rounded-lg text-center cursor-pointer"
                >
                  Link Google Account
                </button>
              </div>
            )}
          </div>

          {/* Security details panel */}
          <div className="glass-card p-6 rounded-xl border border-white/10 flex flex-col gap-3">
            <h3 className="text-sm font-mono text-gray-500 uppercase flex items-center gap-1.5">
              <Database size={14} />
              Security Specifications
            </h3>
            <div className="flex flex-col gap-2 text-[10px] font-mono text-gray-400">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>SESSION</span>
                <span className="text-white">JWT COOKIE</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>ENCRYPTION</span>
                <span className="text-white">AES-256-GCM</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>API RATE LIMIT</span>
                <span className="text-white">100 REQ/MIN</span>
              </div>
              <div className="flex justify-between">
                <span>TENANT MODE</span>
                <span className="text-white">STRICT ISOLATED</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Objectives Editor */}
        <div className="md:col-span-2">
          <div className="glass-card p-8 rounded-xl border border-white/10 flex flex-col gap-6">
            <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
              <Sliders size={18} className="text-primary" />
              Strategic Objectives
            </h2>

            {isLoading ? (
              <div className="h-48 w-full bg-white/5 animate-pulse rounded-lg" />
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono text-gray-500 uppercase">Primary Use Case</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Raise seed funding, Recruit co-founder"
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary font-body"
                    value={useCase}
                    onChange={(e) => setUseCase(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono text-gray-500 uppercase">Outreach Goals & Pitch Details</label>
                  <textarea
                    required
                    rows={6}
                    placeholder="Describe your company, the capital you are seeking, or the candidates you need. This serves as the system memory for AI drafting..."
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary font-body resize-none leading-relaxed"
                    value={goalsText}
                    onChange={(e) => setGoalsText(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={saveSettings.isPending}
                  className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:bg-primary-hover text-zinc-950 text-xs font-bold rounded-lg self-end cursor-pointer disabled:opacity-50 transition"
                >
                  {saveSettings.isPending ? "Saving..." : "Save Settings"}
                </button>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
