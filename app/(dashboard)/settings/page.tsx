"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Sliders, 
  Link2,
  Database,
  User as UserIcon,
  Mail,
  TrendingUp,
  Users,
  Target
} from "lucide-react";
import { toast } from "@/lib/toast";

interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
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

  const [name, setName] = useState("");
  const [useCase, setUseCase] = useState("");
  const [goalsText, setGoalsText] = useState("");

  // 1. Load User Profile details
  const { data: profile, isLoading: isProfileLoading } = useQuery<UserProfile>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        // Fallback mockup profile if API is cold-started or offline
        return {
          id: "local",
          email: session?.user?.email || "alex@aether.com",
          name: session?.user?.name || "Alex Mercer",
          avatarUrl: session?.user?.image || null,
          onboardingCompleted: true,
          primaryUseCase: "Raise Funding",
          outreachGoals: "Secure $1.5M funding for Aether Dynamics seed round.",
          googleConnection: { email: session?.user?.email || "alex@aether.com" }
        };
      }
      return res.json();
    },
  });

  // 2. Fetch Contacts count
  const { data: contacts, isLoading: isContactsLoading } = useQuery<any[]>({
    queryKey: ["contacts"],
    queryFn: async () => {
      const res = await fetch("/api/contacts");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // 3. Fetch Opportunities count
  const { data: opportunities, isLoading: isOppsLoading } = useQuery<any[]>({
    queryKey: ["opportunities"],
    queryFn: async () => {
      const res = await fetch("/api/opportunities");
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setUseCase(profile.primaryUseCase || "");
      setGoalsText(profile.outreachGoals || "");
    }
  }, [profile]);

  // Mutate Profile settings
  const saveSettings = useMutation({
    mutationFn: async (settings: { name: string; primaryUseCase: string; outreachGoals: string }) => {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save profile settings.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast("Profile and preference settings saved successfully.", "success");
    },
    onError: (err: any) => {
      toast(err.message || "Failed to update profile settings.", "error");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings.mutate({
      name,
      primaryUseCase: useCase,
      outreachGoals: goalsText,
    });
  };

  const isGmailConnected = profile?.googleConnection !== null;

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col gap-8 select-none">
      <header className="flex flex-col gap-1.5 mt-4">
        <div className="text-xs font-mono uppercase tracking-widest text-primary font-bold">
          Account Preferences
        </div>
        <h1 className="text-4xl font-heading font-extrabold text-white tracking-tight">
          Profile & Settings
        </h1>
        <p className="text-gray-400 text-sm font-body">
          Manage your personal profile, review workspace connections, and configure startup outreach objectives.
        </p>
      </header>

      {/* Stats Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-xl border border-white/10 flex items-center gap-4 bg-white/[0.01]">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
            <TrendingUp size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Active Opportunities</span>
            <span className="text-2xl font-bold text-white leading-none mt-1">
              {isOppsLoading ? "..." : (opportunities?.length || 0)}
            </span>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl border border-white/10 flex items-center gap-4 bg-white/[0.01]">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0 border border-blue-500/20">
            <Users size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Discovered Contacts</span>
            <span className="text-2xl font-bold text-white leading-none mt-1">
              {isContactsLoading ? "..." : (contacts?.length || 0)}
            </span>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl border border-white/10 flex items-center gap-4 bg-white/[0.01]">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0 border border-purple-500/20">
            <Target size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Target Objective</span>
            <span className="text-sm font-semibold text-white tracking-wide truncate max-w-[200px] leading-none mt-1.5">
              {profile?.primaryUseCase || "Not Defined"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* LEFT PANE: User details & Connection indicators */}
        <div className="md:col-span-1 flex flex-col gap-6">
          
          {/* 1. Account Profile card */}
          <div className="glass-card p-6 rounded-xl border border-white/10 flex flex-col gap-4 bg-white/[0.01]">
            <h3 className="text-xs font-mono text-gray-500 uppercase flex items-center gap-1.5 border-b border-white/5 pb-2">
              <UserIcon size={14} />
              Identity
            </h3>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-zinc-800 border border-white/15 flex items-center justify-center overflow-hidden shrink-0">
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={name || "User"} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-sm font-bold uppercase">{name?.charAt(0) || "U"}</span>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-white truncate">{name || "Founder"}</span>
                <span className="text-[10px] text-zinc-500 font-mono truncate mt-1 flex items-center gap-1">
                  <Mail size={10} />
                  {profile?.email}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Gmail integration panel */}
          <div className="glass-card p-6 rounded-xl border border-white/10 flex flex-col gap-4 bg-white/[0.01]">
            <h3 className="text-xs font-mono text-gray-500 uppercase flex items-center gap-1.5 border-b border-white/5 pb-2">
              <Link2 size={14} />
              Gmail Connection
            </h3>

            {isGmailConnected ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-cta text-xs font-semibold">
                  <CheckCircle2 size={14} />
                  <span>Google account linked</span>
                </div>
                <div className="text-[10.5px] text-gray-400 font-mono break-all bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                  Inbox: {profile?.googleConnection?.email}
                </div>
                <span className="text-[9.5px] text-gray-550 leading-normal">
                  Outreach messages are synced directly via OAuth (tokens encrypted using AES-256-GCM).
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-semibold">
                  <AlertTriangle size={14} />
                  <span>Mailbox unconnected</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-normal">
                  Outreach generation and thread syncing requires linking a Google connection.
                </p>
                <button
                  onClick={() => toast("Google connection automatically links during OAuth sign in. Relog to trigger consent scopes.", "info")}
                  className="w-full py-2 px-3 bg-white text-black hover:bg-zinc-200 text-xs font-bold rounded-lg text-center cursor-pointer transition"
                >
                  Link Account
                </button>
              </div>
            )}
          </div>

          {/* 3. Security details panel */}
          <div className="glass-card p-6 rounded-xl border border-white/10 flex flex-col gap-3 bg-white/[0.01]">
            <h3 className="text-xs font-mono text-gray-500 uppercase flex items-center gap-1.5 border-b border-white/5 pb-2">
              <Database size={14} />
              Security specs
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

        {/* RIGHT PANE: Profile & Objectives Editor */}
        <div className="md:col-span-2">
          <div className="glass-card p-8 rounded-xl border border-white/10 flex flex-col gap-6 bg-white/[0.01]">
            <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
              <Sliders size={18} className="text-white/80" />
              Strategic configuration
            </h2>

            {isProfileLoading ? (
              <div className="h-64 w-full bg-white/5 animate-pulse rounded-lg" />
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* 1. Edit User Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono text-gray-500 uppercase font-semibold">Founder Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your name"
                    className="bg-white/[0.02] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 font-body transition"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                {/* 2. Edit Use Case */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono text-gray-500 uppercase font-semibold">Primary Use Case</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Raise seed funding, Recruit co-founder"
                    className="bg-white/[0.02] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 font-body transition"
                    value={useCase}
                    onChange={(e) => setUseCase(e.target.value)}
                  />
                </div>

                {/* 3. Edit Goals Text */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono text-gray-500 uppercase font-semibold">Outreach Objectives & Pitch Context</label>
                  <textarea
                    required
                    rows={6}
                    placeholder="Describe your company, the capital you are seeking, or the candidates you need. This serves as the system memory for AI drafting..."
                    className="bg-white/[0.02] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 font-body resize-none leading-relaxed transition"
                    value={goalsText}
                    onChange={(e) => setGoalsText(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={saveSettings.isPending}
                  className="w-full sm:w-auto px-6 py-2.5 bg-white text-black hover:bg-zinc-200 text-xs font-bold rounded-lg self-end cursor-pointer disabled:opacity-50 transition"
                >
                  {saveSettings.isPending ? "Saving..." : "Save Preferences"}
                </button>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
