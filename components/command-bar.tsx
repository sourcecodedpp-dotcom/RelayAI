"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Terminal, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";

export function CommandBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Handle global key binds (Cmd/Ctrl + K to toggle, Esc to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const commands = [
    {
      action: "Draft follow-up for Sarah Chen",
      category: "AI Outreach",
      shortcut: "F1",
      handler: () => {
        router.push("/outreach");
        setIsOpen(false);
      },
    },
    {
      action: "Research new target contact",
      category: "AI Intelligence",
      shortcut: "F2",
      handler: () => {
        router.push("/relationships");
        setIsOpen(false);
      },
    },
    {
      action: "Schedule follow-up reminder",
      category: "Action Plan",
      shortcut: "F3",
      handler: () => {
        router.push("/follow-ups");
        setIsOpen(false);
      },
    },
    {
      action: "Configure settings and objectives",
      category: "Preferences",
      shortcut: "F4",
      handler: () => {
        router.push("/settings");
        setIsOpen(false);
      },
    },
  ];

  // Filter commands by search query
  const filteredCommands = commands.filter((cmd) =>
    cmd.action.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleCommandSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: query }),
      });

      if (!res.ok) {
        throw new Error("Failed to process command.");
      }

      const data = await res.json();
      if (data.message) {
        toast(data.message, "success");
      }

      if (data.action === "redirect" && data.url) {
        router.push(data.url);
        setIsOpen(false);
      }
    } catch (err: any) {
      toast(err.message || "Error running command.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommandSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]">
      <div 
        className="glass-card max-w-2xl w-full rounded-xl border border-white/10 overflow-hidden flex flex-col shadow-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5 bg-bg-dark/40">
          <Terminal size={18} className="text-zinc-400" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-sm font-mono"
            placeholder="Ask Relay AI... (e.g. 'Draft a follow-up for Sarah')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button 
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-white p-0.5 cursor-pointer"
            disabled={isLoading}
          >
            <X size={16} />
          </button>
        </div>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="p-8 text-center text-sm text-gray-400 font-mono flex flex-col items-center justify-center gap-2">
            <Loader2 className="animate-spin text-white" size={24} />
            <span>Relay AI routing your request...</span>
          </div>
        )}

        {/* Results List */}
        {!isLoading && (
          <div className="max-h-[300px] overflow-y-auto p-2 flex flex-col gap-1">
            {filteredCommands.map((cmd, idx) => (
              <button
                key={idx}
                onClick={cmd.handler}
                className="w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between hover:bg-white/5 cursor-pointer transition select-none text-sm group"
              >
                <div className="flex items-center gap-3">
                  <Sparkles size={14} className="text-gray-500 group-hover:text-white transition" />
                  <span className="text-gray-200 group-hover:text-white transition font-medium">{cmd.action}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/5 text-gray-500 group-hover:bg-white/10 group-hover:text-white transition">
                    {cmd.category}
                  </span>
                  <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-gray-600 bg-bg-dark/40">
                    {cmd.shortcut}
                  </kbd>
                </div>
              </button>
            ))}

            {query.trim().length > 0 && (
              <button
                onClick={() => handleCommandSubmit()}
                className="w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 hover:bg-white/5 cursor-pointer transition text-sm border-t border-white/5"
              >
                <Sparkles size={14} className="text-white animate-pulse" />
                <span className="text-white font-semibold">
                  Ask Relay AI to: <span className="italic">"{query}"</span>
                </span>
                <span className="ml-auto text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/10 text-white">
                  Execute Agent
                </span>
              </button>
            )}
          </div>
        )}

        {/* Footer Hints */}
        <div className="px-4 py-2 border-t border-white/5 bg-bg-dark/20 text-[10px] font-mono text-gray-600 flex items-center justify-between">
          <div>
            Press <span className="text-gray-500 font-semibold">ENTER</span> to run AI instruction • Cmd+K to dismiss
          </div>
          <div>
            Press <span className="text-gray-500 font-semibold">ESC</span> to exit
          </div>
        </div>
      </div>
    </div>
  );
}
export default CommandBar;
