"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  User, 
  Mail, 
  Target, 
  TrendingUp, 
  Users, 
  Calendar,
  AlertCircle,
  Save,
  CheckCircle2
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

export default function ProfilePage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [useCase, setUseCase] = useState("");
  const [goalsText, setGoalsText] = useState("");

  // 1. Fetch User Profile
  const { data: profile, isLoading: isProfileLoading } = useQuery<UserProfile>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Failed to fetch profile.");
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

  // Populate local form states
  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setUseCase(profile.primaryUseCase || "");
      setGoalsText(profile.outreachGoals || "");
    }
  }, [profile]);

  // Mutation to update profile info
  const updateProfile = useMutation({
    mutationFn: async (updatedData: { name: string; primaryUseCase: string; outreachGoals: string }) => {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });
      if (!res.ok) throw new Error("Failed to update profile.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast("Profile updated successfully.", "success");
    },
    onError: (err: any) => {
      toast(err.message || "Failed to update profile.", "error");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({
      name,
      primaryUseCase: useCase,
      outreachGoals: goalsText,
    });
  };

  const isLoading = isProfileLoading || isContactsLoading || isOppsLoading;

  const stats = [
    {
      label: "Total Contacts",
      value: contacts?.length || 0,
      icon: Users,
      color: "text-zinc-400",
    },
    {
      label: "Pending Action items",
      value: opportunities?.filter(o => o.status === "PENDING").length || 0,
      icon: Target,
      color: "text-white",
    },
    {
      label: "Goals Active",
      value: useCase ? 1 : 0,
      icon: TrendingUp,
      color: "text-zinc-300",
    },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <header className="flex flex-col gap-1.5 mt-4">
        <div className="text-xs font-mono uppercase tracking-widest text-white/50 font-bold">
          Account Administration
        </div>
        <h1 className="text-4xl font-heading font-extrabold text-white tracking-tight">
          User Profile & Analytics
        </h1>
        <p className="text-gray-400 text-sm font-body">
          Manage your contact credentials, objectives, and view agentic performance metrics.
        </p>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          <div className="h-28 bg-white/5 rounded-xl border border-white/5" />
          <div className="h-28 bg-white/5 rounded-xl border border-white/5" />
          <div className="h-28 bg-white/5 rounded-xl border border-white/5" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div key={idx} className="glass-card p-6 rounded-xl border border-white/10 flex items-center justify-between shadow-lg">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-500 font-mono uppercase tracking-wider">{stat.label}</span>
                    <span className="text-3xl font-bold text-white tracking-tight">{stat.value}</span>
                  </div>
                  <div className={`p-3 bg-white/5 rounded-lg border border-white/5 ${stat.color}`}>
                    <Icon size={20} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* User Info Card */}
            <div className="md:col-span-1 flex flex-col gap-6">
              <div className="glass-card p-6 rounded-xl border border-white/10 flex flex-col items-center text-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white font-mono text-3xl font-extrabold shadow-inner relative group">
                  {name ? name.substring(0, 2).toUpperCase() : "US"}
                  <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer text-xs font-mono">
                    EDIT
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-bold text-white leading-snug">{name || "User Name"}</h3>
                  <div className="flex items-center gap-1.5 justify-center text-xs text-gray-400 font-mono">
                    <Mail size={12} className="shrink-0" />
                    <span>{profile?.email}</span>
                  </div>
                </div>

                <div className="w-full border-t border-white/5 my-2" />

                <div className="w-full flex flex-col gap-2.5 items-start text-left">
                  <span className="text-[10px] font-mono text-gray-500 uppercase">System Status</span>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-zinc-300 font-medium">Tenant Active & Isolated</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {profile?.googleConnection ? (
                      <>
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        <span className="text-zinc-300">Google linked</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={12} className="text-amber-500" />
                        <span className="text-zinc-400">Google unlinked</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Edit Form */}
            <div className="md:col-span-2">
              <form onSubmit={handleSubmit} className="glass-card p-6 md:p-8 rounded-xl border border-white/10 flex flex-col gap-6 shadow-xl">
                <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
                  <User size={16} className="text-zinc-400" />
                  Account Details
                </h2>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your name"
                    className="bg-black/30 border border-white/5 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white/20 font-body transition duration-200"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Primary Use Case</label>
                  <input
                    type="text"
                    placeholder="e.g., Raise seed funding, Hire engineering team"
                    className="bg-black/30 border border-white/5 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white/20 font-body transition duration-200"
                    value={useCase}
                    onChange={(e) => setUseCase(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Pitch Details & Goals</label>
                  <textarea
                    rows={5}
                    placeholder="Provide details about your startup, candidates you seek, or funding goals. AI uses this context to draft outreach."
                    className="bg-black/30 border border-white/5 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white/20 font-body leading-relaxed resize-none transition duration-200"
                    value={goalsText}
                    onChange={(e) => setGoalsText(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={updateProfile.isPending}
                  className="px-5 py-2.5 bg-white hover:bg-zinc-200 disabled:opacity-40 text-black text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 self-end transition duration-200 cursor-pointer shadow-md"
                >
                  <Save size={14} />
                  {updateProfile.isPending ? "Saving..." : "Save Profile"}
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
