"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { 
  Inbox, 
  Send, 
  FileText, 
  Search, 
  RefreshCw, 
  Sparkles, 
  CornerUpLeft, 
  CheckCircle2, 
  ArrowLeft,
  Mail,
  User,
  Plus
} from "lucide-react";
import { LemniscateLoader } from "@/components/lemniscate-loader";
import { toast } from "@/lib/toast";

interface Thread {
  id: string;
  snippet: string;
  messageCount: number;
  from: string;
  to: string;
  fromEmail: string;
  subject: string;
  date: string;
  contact?: {
    id: string;
    name: string;
    relationshipStatus: string;
    company: string;
    role: string;
  } | null;
}

interface Message {
  id: string;
  snippet: string;
  from: string;
  to: string;
  date: string;
  subject: string;
  body: string;
}

export default function GmailPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [folder, setFolder] = useState<"INBOX" | "SENT" | "DRAFTS">("INBOX");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  
  // Composer states
  const [replyText, setReplyText] = useState("");
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Gmail threads
  const { 
    data: threadsData, 
    isLoading: isThreadsLoading, 
    isRefetching: isThreadsRefetching, 
    isError: isThreadsError,
    error: threadsError,
    refetch: refetchThreads 
  } = useQuery<{ connected: boolean; threads: Thread[] }, any>({
    queryKey: ["gmail-threads", folder, searchQuery],
    queryFn: async () => {
      const qParams = new URLSearchParams({ folder });
      if (searchQuery) qParams.append("q", searchQuery);
      
      const res = await fetch(`/api/gmail/threads?${qParams.toString()}`);
      if (!res.ok) {
        let errMsg = "Failed to fetch Gmail threads.";
        try {
          const errData = await res.json();
          errMsg = errData.message || errMsg;
        } catch {}
        const error = new Error(errMsg);
        (error as any).status = res.status;
        throw error;
      }
      return res.json();
    },
  });

  // 2. Fetch specific thread detail
  const { data: threadDetail, isLoading: isThreadDetailLoading } = useQuery<{ threadId: string; messages: Message[] }>({
    queryKey: ["gmail-thread-detail", activeThreadId],
    queryFn: async () => {
      if (!activeThreadId) return null;
      const res = await fetch(`/api/gmail/threads/${activeThreadId}`);
      if (!res.ok) throw new Error("Failed to fetch thread messages.");
      return res.json();
    },
    enabled: !!activeThreadId,
  });

  // Auto-scroll thread messages to bottom on detail load
  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [threadDetail]);

  // Mutation: Send Reply or Create Draft
  const sendEmail = useMutation({
    mutationFn: async (payload: { to: string; subject: string; body: string; threadId: string; action: "send" | "draft" }) => {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to process email action.");
      }
      return res.json();
    },
    onSuccess: (resData, variables) => {
      toast(variables.action === "send" ? "Email sent successfully." : "Draft created in Gmail.", "success");
      setReplyText("");
      refetchThreads();
      if (activeThreadId) {
        queryClient.invalidateQueries({ queryKey: ["gmail-thread-detail", activeThreadId] });
      }
    },
    onError: (err: any) => {
      toast(err.message || "Error running email dispatch.", "error");
    },
  });

  // Action: Generate reply using Mercury-2
  const handleGenerateReply = async () => {
    if (!threadDetail || threadDetail.messages.length === 0) return;
    
    setIsGeneratingReply(true);
    toast("Mercury-2 is analyzing thread history...", "info");

    try {
      // Map thread history for API prompt payload
      const threadHistory = threadDetail.messages.map(m => ({
        from: m.from,
        to: m.to,
        date: m.date,
        body: m.body,
      }));

      const res = await fetch("/api/gmail/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: activeThreadId,
          messages: threadHistory,
        }),
      });

      if (!res.ok) {
        throw new Error("Unable to draft AI response.");
      }

      const data = await res.json();
      setReplyText(data.replyText);
      toast("AI reply generated successfully.", "success");
    } catch (err: any) {
      toast(err.message || "Error generating AI response.", "error");
    } finally {
      setIsGeneratingReply(false);
    }
  };

  const handleSendOrDraft = (action: "send" | "draft") => {
    if (!replyText.trim() || !threadDetail) return;
    
    // Find recipient details (reply to the last sender in history who is not the user)
    const messages = threadDetail.messages;
    const lastMsg = messages[messages.length - 1];
    
    // If last message has From, reply to that. 
    // Construct reply subject (Prepend Re: if not present)
    let subject = lastMsg.subject;
    if (subject && !subject.toLowerCase().startsWith("re:")) {
      subject = `Re: ${subject}`;
    }

    // Extract clean email address from sender header
    const emailMatch = lastMsg.from.match(/<([^>]+)>/);
    const recipient = emailMatch ? emailMatch[1] : lastMsg.from;

    sendEmail.mutate({
      to: recipient,
      subject: subject || "Reply to email",
      body: replyText,
      threadId: activeThreadId!,
      action,
    });
  };

  const isConnected = threadsData?.connected !== false;

  return (
    <div className="flex h-screen bg-bg-dark text-gray-200 overflow-hidden w-full relative">
      
      {/* 1. DISCONNECTED BANNER SCREEN */}
      {!isThreadsLoading && !isConnected && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-auto gap-6">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400">
            <Mail size={32} />
          </div>
          
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Connect your Gmail</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Sync and orchestrate your emails directly from Relay AI. AI email drafting and threads updates require linking your Google Account.
            </p>
          </div>

          <a
            href="/api/auth/gmail"
            className="px-6 py-3 bg-white hover:bg-zinc-200 text-black text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition duration-200 shadow-lg cursor-pointer w-full"
          >
            <Plus size={16} />
            Connect Google Mailbox
          </a>
        </div>
      )}

      {isConnected && (
        <>
          {/* 2. THREADS LIST COLUMN PANEL */}
          <div className={`w-full md:w-96 border-r border-white/5 bg-bg-dark flex flex-col shrink-0 ${activeThreadId ? "hidden md:flex" : "flex"}`}>
            
            {/* List Header */}
            <div className="p-4 border-b border-white/5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-1.5">
                  <Mail size={12} />
                  Inbox Sync
                </span>
                <button
                  onClick={() => refetchThreads()}
                  disabled={isThreadsLoading || isThreadsRefetching}
                  className="p-1.5 text-zinc-400 hover:text-white rounded transition cursor-pointer"
                >
                  <RefreshCw size={14} className={isThreadsRefetching ? "animate-spin" : ""} />
                </button>
              </div>

              {/* Folders Tab bar */}
              <div className="flex bg-black/40 border border-white/5 p-1 rounded-lg">
                {[
                  { id: "INBOX", label: "Inbox", icon: Inbox },
                  { id: "SENT", label: "Sent", icon: Send },
                  { id: "DRAFTS", label: "Drafts", icon: FileText }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = folder === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setFolder(tab.id as any);
                        setActiveThreadId(null);
                      }}
                      className={`flex-1 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer select-none ${
                        isActive ? "bg-white text-black font-bold shadow-sm" : "text-zinc-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Icon size={12} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div className="flex items-center gap-2 px-3 py-2 bg-black/30 border border-white/5 rounded-lg focus-within:border-white/20 transition-all duration-200">
                <Search size={14} className="text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search threads..."
                  className="bg-transparent border-none outline-none text-xs text-white placeholder-zinc-500 w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Thread List Items */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {isThreadsLoading ? (
                <div className="p-8 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
                  <LemniscateLoader size="md" label="Loading threads" className="text-zinc-400" />
                </div>
              ) : isThreadsError ? (
                <div className="p-6 text-center flex flex-col items-center justify-center gap-3">
                  {(() => {
                    const isAuthError = threadsError?.status === 401 || 
                                        threadsError?.status === 403 || 
                                        threadsError?.message?.toLowerCase().includes("invalid_grant") || 
                                        threadsError?.message?.toLowerCase().includes("auth") || 
                                        threadsError?.message?.toLowerCase().includes("revoke") || 
                                        threadsError?.message?.toLowerCase().includes("expired");
                    return (
                      <>
                        <div className="text-red-400/80 text-xs font-mono font-bold uppercase tracking-wider">
                          {isAuthError
                            ? "Reconnect Gmail"
                            : threadsError?.status === 500
                            ? "Gmail temporarily unavailable"
                            : "Check your connection"}
                        </div>
                        <p className="text-zinc-400 text-xs leading-relaxed max-w-[280px]">
                          {isAuthError
                            ? "Your Google OAuth session has expired or permissions were revoked. Please reconnect your account."
                            : threadsError?.status === 500
                            ? "The server encountered an error calling the Gmail API. Please try again later."
                            : "We couldn't reach the server. Please verify your internet connection and try again."}
                        </p>
                        {isAuthError ? (
                          <a
                            href="/api/auth/gmail"
                            className="mt-2 px-4 py-2 bg-white text-black hover:bg-zinc-200 text-xs font-bold rounded-lg transition shadow-md inline-block"
                          >
                            Reconnect Gmail
                          </a>
                        ) : (
                          <button
                            onClick={() => refetchThreads()}
                            className="mt-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 mx-auto cursor-pointer"
                          >
                            <RefreshCw size={12} className={isThreadsRefetching ? "animate-spin" : ""} />
                            Retry Connection
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : threadsData?.threads && threadsData.threads.length > 0 ? (
                threadsData.threads.map((thread) => {
                  const isActive = activeThreadId === thread.id;
                  return (
                    <div
                      key={thread.id}
                      onClick={() => setActiveThreadId(thread.id)}
                      className={`p-4 flex flex-col gap-2 transition cursor-pointer select-none border-l-2 ${
                        isActive 
                          ? "bg-white/5 border-white" 
                          : "border-transparent hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate max-w-[150px]">
                          {thread.from.split("<")[0].trim() || thread.fromEmail}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                          {new Date(thread.date).toLocaleDateString()}
                        </span>
                      </div>

                      <h4 className="text-xs font-semibold text-zinc-300 truncate">
                        {thread.subject}
                      </h4>

                      <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                        {thread.snippet}
                      </p>

                      {/* AI Actionability Badges */}
                      {thread.contact && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white font-semibold">
                            {thread.contact.relationshipStatus}
                          </span>
                          <span className="text-[9px] font-mono text-zinc-400">
                            {thread.contact.name} • {thread.contact.company}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs text-zinc-600">
                  No emails found.
                </div>
              )}
            </div>
          </div>

          {/* 3. THREAD MESSAGES DETAIL DISPLAY PANE */}
          <div className={`flex-1 flex flex-col h-full bg-black/10 overflow-hidden ${!activeThreadId ? "hidden md:flex" : "flex"}`}>
            
            {activeThreadId ? (
              <>
                {/* Detail Header */}
                <div className="p-4 border-b border-white/5 bg-bg-dark flex items-center gap-3">
                  <button
                    onClick={() => setActiveThreadId(null)}
                    className="p-1 text-zinc-400 hover:text-white rounded md:hidden transition cursor-pointer"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-white truncate">
                      {threadDetail?.messages?.[0]?.subject || "Loading Thread..."}
                    </h2>
                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                      Thread ID: {activeThreadId}
                    </p>
                  </div>
                </div>

                {/* Message transcripts */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                  {isThreadDetailLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs">
                      <LemniscateLoader size="md" label="Loading conversation" className="text-zinc-400" />
                    </div>
                  ) : threadDetail?.messages.map((msg) => {
                    const isUser = msg.from.toLowerCase().includes(session?.user?.email?.toLowerCase() || "");
                    return (
                      <div 
                        key={msg.id}
                        className={`flex flex-col gap-1.5 max-w-[85%] ${isUser ? "self-end items-end" : "self-start items-start"}`}
                      >
                        {/* Sender metadata */}
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                          <span className="font-bold text-zinc-400">
                            {isUser ? "You" : msg.from.split("<")[0].trim() || msg.from}
                          </span>
                          <span>•</span>
                          <span>{new Date(msg.date).toLocaleString()}</span>
                        </div>

                        {/* Content bubble */}
                        <div className={`p-4 rounded-2xl border text-xs leading-relaxed font-body whitespace-pre-wrap ${
                          isUser 
                            ? "bg-white text-black border-white shadow-md rounded-tr-none" 
                            : "bg-white/5 text-zinc-200 border-white/10 rounded-tl-none"
                        }`}>
                          {msg.body}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={threadEndRef} />
                </div>

                {/* Composer action box */}
                <div className="p-4 border-t border-white/5 bg-bg-dark flex flex-col gap-3 shrink-0">
                  <div className="relative">
                    <textarea
                      rows={4}
                      placeholder="Write your email reply..."
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-white/15 leading-relaxed resize-none pr-12 font-body"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      disabled={sendEmail.isPending || isGeneratingReply}
                    />

                    {/* AI Suggest Reply Trigger */}
                    <button
                      onClick={handleGenerateReply}
                      disabled={isGeneratingReply || isThreadDetailLoading || sendEmail.isPending}
                      className="absolute right-3.5 bottom-3.5 p-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/5 transition duration-200 disabled:opacity-30 cursor-pointer shadow-lg"
                      title="AI Draft response using Mercury-2"
                    >
                      {isGeneratingReply ? (
                        <LemniscateLoader size="sm" className="text-zinc-400" />
                      ) : (
                        <Sparkles size={14} className="text-zinc-300" />
                      )}
                    </button>
                  </div>

                  {/* Dispatch triggers */}
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                      <CornerUpLeft size={10} />
                      Replying to thread
                    </span>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSendOrDraft("draft")}
                        disabled={!replyText.trim() || sendEmail.isPending || isGeneratingReply}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white text-xs font-bold rounded-lg transition duration-200 cursor-pointer disabled:opacity-40"
                      >
                        Create Draft
                      </button>
                      <button
                        onClick={() => handleSendOrDraft("send")}
                        disabled={!replyText.trim() || sendEmail.isPending || isGeneratingReply}
                        className="px-4 py-2 bg-white hover:bg-zinc-200 text-black text-xs font-bold rounded-lg transition duration-200 cursor-pointer disabled:opacity-40 shadow-md flex items-center gap-1.5"
                      >
                        {sendEmail.isPending ? (
                          <LemniscateLoader size="sm" className="text-current" />
                        ) : (
                          <Send size={12} />
                        )}
                        Send Email
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-500 text-xs">
                <Mail size={24} className="text-zinc-600" />
                <span>Select a thread from the inbox to display details.</span>
              </div>
            )}

          </div>
        </>
      )}

    </div>
  );
}
