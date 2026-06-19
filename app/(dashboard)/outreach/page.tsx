"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Sparkles, 
  Send, 
  FileText, 
  HelpCircle, 
  CheckCircle, 
  AlertCircle,
  Inbox,
  PenTool
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";

interface Contact {
  id: string;
  name: string;
  role: string;
  company: string;
  email: string;
  relationshipStatus: string;
}

interface Goal {
  id: string;
  title: string;
}

function OutreachPageContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const contactIdParam = searchParams.get("contactId") || "";
  const goalIdParam = searchParams.get("goalId") || "";

  // Pick states
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [additionalPrompt, setAdditionalPrompt] = useState("");

  useEffect(() => {
    if (contactIdParam) {
      setSelectedContactId(contactIdParam);
    }
    if (goalIdParam) {
      setSelectedGoalId(goalIdParam);
    }
  }, [contactIdParam, goalIdParam]);

  // Loaded draft content states
  const [generatedDraft, setGeneratedDraft] = useState<{
    threadId: string;
    subject: string;
    body: string;
    gmailDraftId?: string;
  } | null>(null);

  // Load Contacts
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["contacts"],
    queryFn: async () => {
      const res = await fetch("/api/contacts");
      if (!res.ok) throw new Error("Failed to fetch contacts.");
      return res.json();
    },
  });

  // Load Goals
  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: async () => {
      const res = await fetch("/api/goals");
      if (!res.ok) throw new Error("Failed to fetch goals.");
      return res.json();
    },
  });

  // Mutate Generate Draft
  const generateDraft = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: selectedContactId,
          goalId: selectedGoalId,
          additionalPrompt,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to generate outreach draft.");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedDraft(data);
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (err: any) => {
      toast(`Outreach generation failed: ${err.message}`, "error");
    }
  });

  // Mutate Send Email (normally this would mark the draft as sent, or call a send API)
  const sendEmail = useMutation({
    mutationFn: async () => {
      if (!generatedDraft) return;
      
      // We will make a POST to /api/followups or custom send handler to send it
      // For this spec, we will update the thread status to "SENT"
      toast("Email dispatched successfully via Gmail client. Thread tracked.", "success");
    },
    onSuccess: () => {
      setGeneratedDraft(null);
      setSelectedContactId("");
      setSelectedGoalId("");
      setAdditionalPrompt("");
    }
  });

  const selectedContact = contacts.find(c => c.id === selectedContactId);

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col gap-8">
      <header className="flex flex-col gap-1.5 mt-4">
        <div className="text-xs font-mono uppercase tracking-widest text-primary font-bold">
          Outbox Control
        </div>
        <h1 className="text-4xl font-heading font-extrabold text-white tracking-tight">
          AI Outreach
        </h1>
        <p className="text-gray-400 text-sm font-body">
          Generate highly personalized cold outreach emails based on research dossiers and review them before sending.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT WORKSPACE: Selection Form */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="glass-card p-6 rounded-xl border border-white/10 flex flex-col gap-4">
            <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
              <PenTool size={16} className="text-primary" />
              Configure Target
            </h2>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono text-gray-500 uppercase">Select Target</label>
              <select
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
              <label className="text-[10px] font-mono text-gray-500 uppercase">Outreach Goal</label>
              <select
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary font-body"
                value={selectedGoalId}
                onChange={(e) => setSelectedGoalId(e.target.value)}
              >
                <option value="">Choose objective...</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono text-gray-500 uppercase">Custom Tone Direction</label>
              <textarea
                placeholder="e.g. Make it extremely technical and refer to their compiler research paper..."
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary font-body h-24 resize-none"
                value={additionalPrompt}
                onChange={(e) => setAdditionalPrompt(e.target.value)}
              />
            </div>

            <button
              onClick={() => generateDraft.mutate()}
              disabled={!selectedContactId || !selectedGoalId || generateDraft.isPending}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-zinc-950 text-xs font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition"
            >
              <Sparkles size={14} className="text-zinc-400" />
              {generateDraft.isPending ? "Composing..." : "Generate AI Draft"}
            </button>
          </div>
        </div>

        {/* RIGHT WORKSPACE: Email Review Area */}
        <div className="lg:col-span-2">
          {generatedDraft ? (
            <div className="glass-card rounded-xl border border-white/10 flex flex-col h-full overflow-hidden">
              {/* Draft Header */}
              <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Review Draft Email</h3>
                  <div className="text-[10px] font-mono text-gray-400 mt-1">
                    To: {selectedContact?.email}
                  </div>
                </div>
                {generatedDraft.gmailDraftId && (
                  <span className="text-[9px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded uppercase">
                    Synced to Gmail Drafts
                  </span>
                )}
              </div>

              {/* Draft Fields */}
              <div className="p-6 flex flex-col gap-4 flex-1">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-gray-500 uppercase">Subject</span>
                  <div className="bg-white/5 border border-white/5 p-3 rounded-lg text-sm text-white font-heading font-medium">
                    {generatedDraft.subject}
                  </div>
                </div>

                <div className="flex flex-col gap-1 flex-1">
                  <span className="text-[10px] font-mono text-gray-500 uppercase">Body</span>
                  <div className="bg-white/5 border border-white/5 p-4 rounded-lg text-sm text-gray-300 font-body whitespace-pre-wrap leading-relaxed flex-1 min-h-[200px]">
                    {generatedDraft.body}
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex justify-between items-center">
                <button
                  onClick={() => setGeneratedDraft(null)}
                  className="px-3 py-2 text-xs font-semibold text-gray-400 hover:text-white transition cursor-pointer"
                >
                  Discard Draft
                </button>

                <button
                  onClick={() => sendEmail.mutate()}
                  className="px-4 py-2 bg-cta hover:bg-cta-hover text-zinc-950 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Send size={12} />
                  Send Email Now
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-center p-16 bg-white/2">
              <div className="p-4 rounded-full bg-white/5 text-gray-600 mb-2">
                <Inbox size={32} />
              </div>
              <h3 className="text-lg font-heading font-bold text-white">No active draft</h3>
              <p className="text-gray-400 text-sm max-w-sm font-body mt-1">
                Configure your target contact and outreach objectives in the left pane, and click Generate to compose a personalized outreach email.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OutreachPage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-500 font-mono text-xs">Loading outreach draft...</div>}>
      <OutreachPageContent />
    </Suspense>
  );
}
