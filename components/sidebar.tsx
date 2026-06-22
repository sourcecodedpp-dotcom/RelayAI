"use client";

import React, { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { 
  Plus, 
  History,
  Clock,
  Globe,
  Mail,
  Inbox,
  Terminal,
  Settings as SettingsIcon,
  MessageSquare,
  ChevronDown,
  ChevronLeft,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Conversation {
  id: string;
  title: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  status: "active" | "archived";
}

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useEffect(() => {
    try {
      const cached = localStorage.getItem("relay-conversations-cache");
      if (cached) {
        setConversations(JSON.parse(cached));
        setLoading(false);
      }
    } catch (e) {
      console.error("Failed to parse cached conversations", e);
    }

    let active = true;
    async function fetchConvs() {
      try {
        const res = await fetch("/api/conversations");
        if (!res.ok) throw new Error("Failed to fetch conversations");
        const data = await res.json();
        if (active && data.success) {
          const list = data.conversations || [];
          setConversations(list);
          localStorage.setItem("relay-conversations-cache", JSON.stringify(list));
        }
      } catch (err) {
        console.error("Error loading conversations in sidebar:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchConvs();
    return () => {
      active = false;
    };
  }, [pathname]);

  const capabilities = [
    { label: "Orbits", route: "/opportunities", icon: <Globe size={16} /> },
    { label: "Outreach", route: "/outreach", icon: <Mail size={16} /> },
    { label: "Inbox", route: "/gmail", icon: <Inbox size={16} /> },
    { label: "API Monitor", route: "/api", icon: <Terminal size={16} /> },
  ];

  return (
    <aside 
      className={cn(
        "h-full border-r border-white/5 bg-[#0a0a0c] flex flex-col justify-between py-6 shrink-0 z-30 select-none transition-all duration-300 relative overflow-hidden",
        collapsed ? "w-0 border-r-0 py-0 px-0 opacity-0" : "w-64 opacity-100"
      )}
    >
      <div className="flex flex-col flex-grow w-full gap-5 min-w-[240px]">
        
        {/* 1. New Conversation Action Button & Collapse Button */}
        <div className="px-4 flex items-center gap-2">
          <Link
            href="/"
            className="flex-grow flex items-center justify-start gap-2.5 py-2.5 px-4 rounded-lg bg-white/[0.02] border border-white/[0.08] text-zinc-300 font-medium text-[13px] hover:bg-white/[0.05] hover:border-white/[0.12] hover:text-white active:scale-[0.98] transition-all duration-200 truncate"
          >
            <Plus size={14} className="text-zinc-400 shrink-0" />
            <span className="truncate">New Conversation</span>
          </Link>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-2.5 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition shrink-0 flex items-center justify-center h-[38px] w-[38px]"
              title="Collapse Sidebar"
            >
              <ChevronLeft size={15} />
            </button>
          )}
        </div>

        {/* 2. Primary Navigation */}
        <div className="px-3 flex flex-col gap-0.5">
          {/* Conversation History Collapsible */}
          <div>
            <button
              onClick={() => setHistoryExpanded(!historyExpanded)}
              className={cn(
                "flex items-center justify-between w-full px-3 h-10 rounded-lg text-[13px] font-sans tracking-wide transition-all duration-200 group text-zinc-400 hover:text-white hover:bg-white/[0.02] cursor-pointer"
              )}
            >
              <div className="flex items-center gap-2.5">
                <History size={16} className="text-zinc-500 group-hover:text-zinc-300 shrink-0" />
                <span>Conversation History</span>
              </div>
              <ChevronDown 
                size={14} 
                className={cn(
                  "text-zinc-500 transition-transform duration-200", 
                  historyExpanded ? "rotate-180" : ""
                )} 
              />
            </button>

            {/* Collapsible Content */}
            <AnimatePresence initial={false}>
              {historyExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="max-h-[350px] overflow-y-auto pl-7 pr-2 py-1 space-y-1 bg-white/[0.01] rounded-lg mt-0.5 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent"
                >
                  {loading ? (
                    <div className="py-2 text-[11px] text-zinc-650 font-mono animate-pulse">Loading conversations...</div>
                  ) : conversations.length === 0 ? (
                    <div className="py-2 text-[11px] text-zinc-600 font-mono italic">No history found.</div>
                  ) : (
                    conversations.map((conv) => {
                      const isActive = pathname === `/c/${conv.id}`;
                      return (
                        <Link
                          key={conv.id}
                          href={`/c/${conv.id}`}
                          className={cn(
                            "flex items-center gap-2 py-2 px-2.5 rounded-md text-[11.5px] transition-colors truncate w-full",
                            isActive 
                              ? "bg-white/[0.06] text-white font-medium" 
                              : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
                          )}
                        >
                          <MessageSquare size={12} className="shrink-0" />
                          <span className="truncate">{conv.title || "Untitled Conversation"}</span>
                        </Link>
                      );
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Scheduled Tasks Link */}
          <Link
            href="/follow-ups"
            className={cn(
              "flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-sans tracking-wide transition-all duration-200 group text-zinc-400 hover:text-white hover:bg-white/[0.02]",
              pathname === "/follow-ups" && "text-white bg-white/[0.04] border border-white/[0.06]"
            )}
          >
            <Clock size={16} className={cn("shrink-0 transition-colors", pathname === "/follow-ups" ? "text-white" : "text-zinc-500 group-hover:text-zinc-300")} />
            <span>Scheduled Tasks</span>
          </Link>

          {/* Capabilities links (Orbits, Outreach, Inbox, API Monitor) */}
          {capabilities.map((cap) => {
            const isActive = pathname === cap.route;
            return (
              <Link
                key={cap.label}
                href={cap.route}
                className={cn(
                  "flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-sans tracking-wide transition-all duration-200 group",
                  isActive
                    ? "text-white bg-white/[0.04] border border-white/[0.06]"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.02]"
                )}
              >
                <div className={cn(
                  "shrink-0 transition-colors duration-200",
                  isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                )}>
                  {cap.icon}
                </div>
                <span>{cap.label}</span>
              </Link>
            );
          })}
        </div>

      </div>

      {/* 3. Footer Settings & Profile Action */}
      <div className="px-3 shrink-0 flex flex-col gap-1 border-t border-white/[0.04] pt-4 min-w-[240px]">
        {/* Settings button */}
        <Link
          href="/settings"
          className={cn(
            "flex items-center justify-between px-3 h-10 rounded-lg text-[13px] font-sans tracking-wide transition-all duration-200 group text-zinc-400 hover:text-white hover:bg-white/[0.02]",
            pathname === "/settings" && "text-white bg-white/[0.04]"
          )}
        >
          <div className="flex items-center gap-2.5">
            <SettingsIcon size={16} className={cn("shrink-0 transition-colors", pathname === "/settings" ? "text-white" : "text-zinc-500 group-hover:text-zinc-300")} />
            <span>Profile & Settings</span>
          </div>
          
          <button
            onClick={(e) => {
              e.preventDefault();
              signOut({ callbackUrl: "/login" });
            }}
            className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
            title="Sign Out"
          >
            <LogOut size={13} />
          </button>
        </Link>
      </div>
    </aside>
  );
}

export default Sidebar;
