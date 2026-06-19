"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { 
  Zap, 
  Globe, 
  Mail, 
  Clock, 
  Settings, 
  Terminal, 
  Sparkles, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  Inbox,
  User
} from "lucide-react";
import { toast } from "@/lib/toast";

interface LogEntry {
  timestamp: string;
  module: string;
  message: string;
  type: "info" | "success" | "error" | "warn";
}

export function AgentConsole() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [currentPlaceholder, setCurrentPlaceholder] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [agentStatus, setAgentStatus] = useState<"idle" | "thinking" | "routing">("idle");
  const [logs, setLogs] = useState<LogEntry[]>([
    { timestamp: "18:05:00", module: "system", message: "Agentic core engine initialized.", type: "info" },
    { timestamp: "18:05:01", module: "memory", message: "Loaded target relationship nodes from Firestore.", type: "info" },
    { timestamp: "18:05:02", module: "gmail", message: "Gmail sync operational.", type: "success" }
  ]);

  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);


  const placeholderPhrases = [
    "Draft a follow-up email to Sarah Chen...",
    "Show my strategic relationships orbits...",
    "Register a new investor contact Priya Sharma...",
    "Show me today's daily briefing and action items...",
    "Configure connection settings and objectives..."
  ];

  // Typing effect for the placeholder
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const currentPhrase = placeholderPhrases[placeholderIndex];

    if (isDeleting) {
      timer = setTimeout(() => {
        setCurrentPlaceholder(currentPhrase.substring(0, charIndex - 1));
        setCharIndex((prev) => prev - 1);
      }, 30);
    } else {
      timer = setTimeout(() => {
        setCurrentPlaceholder(currentPhrase.substring(0, charIndex + 1));
        setCharIndex((prev) => prev + 1);
      }, 50);
    }

    if (!isDeleting && charIndex === currentPhrase.length) {
      // Pause at full phrase
      timer = setTimeout(() => setIsDeleting(true), 2500);
    } else if (isDeleting && charIndex === 0) {
      setIsDeleting(false);
      setPlaceholderIndex((prev) => (prev + 1) % placeholderPhrases.length);
    }

    return () => clearTimeout(timer);
  }, [charIndex, isDeleting, placeholderIndex]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const addLog = (module: string, message: string, type: "info" | "success" | "error" | "warn" = "info") => {
    const now = new Date();
    const timestamp = now.toTimeString().split(" ")[0];
    setLogs((prev) => [...prev, { timestamp, module, message, type }]);
  };

  const handleCommandSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setAgentStatus("thinking");
    addLog("router", `Received query: "${query}"`, "info");
    
    // Auto-expand terminal for creative visual feedback
    setIsLogOpen(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 800)); // Dramatic pause for "intelligence reasoning"
      
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: query }),
      });

      if (!res.ok) {
        throw new Error("Failed to process command.");
      }

      const data = await res.json();
      setAgentStatus("routing");

      const success = data.success !== false;
      if (success) {
        const intent = data.data?.intent || data.intent || "unknown";
        const firstAction = data.actions?.[0];
        const actionType = firstAction?.type || data.action || "redirect";
        const actionUrl = firstAction?.url || data.url || "/briefing";
        const message = data.summary || data.message || data.data?.message || "Command executed successfully.";

        addLog("agent", `Intent classified as: "${intent}"`, "success");
        addLog("navigator", `Routing action: ${actionType} to ${actionUrl}`, "info");

        if (message) {
          toast(message, "success");
          addLog("system", message, "success");
        }

        if (actionType === "redirect" && actionUrl) {
          await new Promise(resolve => setTimeout(resolve, 600)); // Let the user read the log line
          router.push(actionUrl);
        }
      } else {
        const errMsg = data.error || "Error running command.";
        toast(errMsg, "error");
        addLog("system", `Execution failed: ${errMsg}`, "error");
      }
    } catch (err: any) {
      setAgentStatus("idle");
      const errMsg = err.message || "Error running command.";
      toast(errMsg, "error");
      addLog("system", `Execution failed: ${errMsg}`, "error");
    } finally {
      setIsLoading(false);
      setAgentStatus("idle");
      setQuery("");
    }
  };


  const quickChips = [
    { label: "Briefing", icon: Zap, url: "/briefing" },
    { label: "Orbits Canvas", icon: Globe, url: "/relationships" },
    { label: "Outreach Studio", icon: Mail, url: "/outreach" },
    { label: "Reminders", icon: Clock, url: "/follow-ups" },
    { label: "Inbox", icon: Inbox, url: "/gmail" },
    { label: "API Monitor", icon: Terminal, url: "/api" },
    { label: "Profile", icon: User, url: "/profile" },
  ];

  // Hide the layout header console on the main chat screen to avoid redundancy
  if (pathname === "/briefing") {
    return null;
  }

  return (
    <div className="p-6 pb-3 shrink-0 border-b border-white/5 bg-bg-dark/40 backdrop-blur-md z-20 w-full">
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-3 relative z-30">
      
      {/* Glow Backdrop */}
      <div className="absolute -inset-1 bg-gradient-to-r from-white/5 via-zinc-800/10 to-white/5 rounded-2xl blur-lg opacity-70 pointer-events-none" />

      {/* Main Console Box */}
      <div className="relative glass-card rounded-2xl border border-white/10 p-5 shadow-2xl transition-all duration-300 hover:border-white/15">
        
        {/* Status Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-white/40" />
            <span className="text-[10px] font-mono tracking-widest text-white/50 uppercase font-bold">
              Agent Control Center
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                agentStatus === "thinking" ? "bg-amber-400" : agentStatus === "routing" ? "bg-purple-400" : "bg-emerald-400"
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                agentStatus === "thinking" ? "bg-amber-500" : agentStatus === "routing" ? "bg-purple-500" : "bg-emerald-500"
              }`}></span>
            </span>
            <span className="text-[10px] font-mono text-white/60 select-none">
              {agentStatus === "thinking" ? "Thinking..." : agentStatus === "routing" ? "Routing UI..." : "Agent Active"}
            </span>
          </div>
        </div>

        {/* Command Form */}
        <form onSubmit={handleCommandSubmit} className="relative">
          <div className="flex items-center gap-3 px-4 py-3.5 bg-black/40 border border-white/5 rounded-xl focus-within:border-white/20 transition-all duration-200">
            <Sparkles size={16} className={`text-white/40 ${isLoading ? "animate-pulse" : ""}`} />
            
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent border-none outline-none text-sm font-body text-white placeholder-white/30"
              placeholder={currentPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isLoading}
            />

            {isLoading ? (
              <Loader2 className="animate-spin text-white/40" size={16} />
            ) : (
              <button 
                type="submit"
                disabled={!query.trim()}
                className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 bg-white hover:bg-zinc-200 text-black rounded transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
              >
                Send
              </button>
            )}
          </div>
        </form>

        {/* Quick Navigate Chips */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <span className="text-[10px] font-mono text-white/30 select-none mr-1">Quick Actions:</span>
          {quickChips.map((chip) => {
            const Icon = chip.icon;
            const isActive = pathname === chip.url;
            return (
              <button
                key={chip.label}
                onClick={() => router.push(chip.url)}
                className={`text-[11px] font-medium px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                  isActive 
                    ? "bg-white text-black border-white font-bold" 
                    : "bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <Icon size={12} className={isActive ? "text-black" : "text-zinc-400"} />
                {chip.label}
              </button>
            );
          })}
        </div>

      </div>

      {/* Expandable Agent Logs Terminal */}
      <div className="w-full">
        <button
          onClick={() => setIsLogOpen(!isLogOpen)}
          className="flex items-center gap-1 text-[10px] font-mono text-white/30 hover:text-white/60 transition ml-2 py-1 select-none"
        >
          {isLogOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {isLogOpen ? "Hide Console Logs" : "Show Console Logs"} ({logs.length})
        </button>

        {isLogOpen && (
          <div className="bg-black/90 rounded-xl border border-white/5 p-4 shadow-inner max-h-[160px] overflow-y-auto font-mono text-[10px] flex flex-col gap-1.5 transition-all duration-300 mt-1">
            {logs.map((log, idx) => (
              <div key={idx} className="flex gap-2 items-start leading-relaxed">
                <span className="text-white/20">[{log.timestamp}]</span>
                <span className={`font-bold select-none shrink-0 ${
                  log.type === "success" ? "text-emerald-400/80" : log.type === "error" ? "text-red-400/80" : log.type === "warn" ? "text-amber-400/80" : "text-zinc-500"
                }`}>
                  [{log.module}]
                </span>
                <span className={
                  log.type === "success" ? "text-emerald-200/90" : log.type === "error" ? "text-red-200/90" : log.type === "warn" ? "text-amber-200/90" : "text-zinc-300"
                }>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>
        )}
      </div>

    </div>
    </div>
  );
}

export default AgentConsole;
