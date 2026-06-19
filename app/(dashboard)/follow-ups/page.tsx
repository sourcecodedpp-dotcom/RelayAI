"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Clock, 
  CheckCircle2, 
  Plus, 
  Calendar,
  AlertCircle,
  TrendingUp,
  ChevronRight
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";

interface FollowUp {
  id: string;
  title: string;
  scheduledAt: string;
  completedAt?: string | null;
  status: "PENDING" | "COMPLETED" | "SCHEDULED";
  contact: {
    name: string;
    company: string;
  };
}

interface Contact {
  id: string;
  name: string;
  company: string;
}

function FollowUpsPageContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const contactIdParam = searchParams.get("contactId") || "";

  // Modal / Form states
  const [selectedContactId, setSelectedContactId] = useState("");
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  useEffect(() => {
    if (contactIdParam) {
      setSelectedContactId(contactIdParam);
    }
  }, [contactIdParam]);

  // Fetch FollowUps
  const { data: followUps = [], isLoading } = useQuery<FollowUp[]>({
    queryKey: ["followups"],
    queryFn: async () => {
      const res = await fetch("/api/followups");
      if (!res.ok) throw new Error("Failed to load followups.");
      return res.json();
    },
  });

  // Fetch Contacts
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["contacts"],
    queryFn: async () => {
      const res = await fetch("/api/contacts");
      if (!res.ok) throw new Error("Failed to load contacts.");
      return res.json();
    },
  });

  // Mutate Add FollowUp
  const addFollowUp = useMutation({
    mutationFn: async (newFollowUp: any) => {
      const res = await fetch("/api/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFollowUp),
      });
      if (!res.ok) throw new Error("Failed to schedule follow-up.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      setTitle("");
      setSelectedContactId("");
      setScheduledAt("");
      toast("Follow-up reminder scheduled successfully.", "success");
    },
  });

  // Mutate Update Status (Complete)
  const completeFollowUp = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/followups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "COMPLETED" }),
      });
      if (!res.ok) throw new Error("Failed to complete follow-up.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast("Follow-up marked as completed.", "success");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !selectedContactId || !scheduledAt) return;
    addFollowUp.mutate({
      contactId: selectedContactId,
      title,
      scheduledAt: new Date(scheduledAt).toISOString(),
    });
  };

  const pendingFollowUps = followUps.filter((f) => f.status !== "COMPLETED");
  const completedFollowUps = followUps.filter((f) => f.status === "COMPLETED");

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col gap-8">
      <header className="flex flex-col gap-1.5 mt-4">
        <div className="text-xs font-mono uppercase tracking-widest text-primary font-bold">
          Outreach Cadence
        </div>
        <h1 className="text-4xl font-heading font-extrabold text-white tracking-tight">
          Follow-ups Queue
        </h1>
        <p className="text-gray-400 text-sm font-body">
          Schedule reminders and manage follow-up sequences. Overdue reminders turn into high-priority opportunities on your briefing feed.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT FORM: Create FollowUp */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6 rounded-xl border border-white/10 flex flex-col gap-4">
            <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
              <Calendar size={16} className="text-zinc-400" />
              Schedule Event
            </h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-gray-500 uppercase">Contact Target</label>
                <select
                  required
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary font-body"
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                >
                  <option value="">Choose contact...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.company})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-gray-500 uppercase">Action Goal</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Send demo loom details"
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary font-body"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-gray-500 uppercase">Remind Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary font-body"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={addFollowUp.isPending}
                className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-zinc-950 text-xs font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition mt-2"
              >
                <Plus size={14} />
                Schedule Reminder
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT FEED: Reminders Lists */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Active Queue */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-mono text-gray-500 uppercase flex items-center gap-1.5">
              <Clock size={14} />
              Active Reminders ({pendingFollowUps.length})
            </h2>

            {isLoading ? (
              <div className="h-24 bg-white/5 border border-white/10 rounded-xl animate-pulse" />
            ) : pendingFollowUps.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-white/10 rounded-xl bg-white/2 text-sm text-gray-500">
                No active follow-ups scheduled.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {pendingFollowUps.map((f) => {
                  const isOverdue = new Date(f.scheduledAt) < new Date();
                  return (
                    <div
                      key={f.id}
                      className="p-4 glass-card rounded-lg border border-white/5 flex items-center justify-between gap-4 group hover:border-white/10 transition"
                    >
                      <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-bold text-white group-hover:text-primary transition">{f.title}</h3>
                        <div className="text-[10px] text-gray-400 font-body flex items-center gap-2">
                          <span>Target: {f.contact.name} ({f.contact.company})</span>
                          <span>•</span>
                          <span className={`${isOverdue ? "text-white font-bold" : "text-gray-500"}`}>
                            Due: {new Date(f.scheduledAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => completeFollowUp.mutate(f.id)}
                        className="p-1.5 hover:bg-cta/20 text-gray-500 hover:text-cta rounded-md cursor-pointer transition"
                        title="Mark Completed"
                      >
                        <CheckCircle2 size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Completed History */}
          {completedFollowUps.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-white/5 pt-6">
              <h2 className="text-sm font-mono text-gray-500 uppercase">
                Completed Cadence History ({completedFollowUps.length})
              </h2>
              <div className="flex flex-col gap-2 opacity-60">
                {completedFollowUps.slice(0, 5).map((f) => (
                  <div
                    key={f.id}
                    className="p-4 bg-white/2 border border-white/5 rounded-lg flex items-center justify-between text-xs"
                  >
                    <div>
                      <h4 className="font-semibold text-gray-300 line-through">{f.title}</h4>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                        Target: {f.contact.name} • Completed at: {new Date(f.completedAt!).toLocaleDateString()}
                      </div>
                    </div>
                    <CheckCircle2 size={14} className="text-cta shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FollowUpsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-500 font-mono text-xs">Loading follow-ups queue...</div>}>
      <FollowUpsPageContent />
    </Suspense>
  );
}
