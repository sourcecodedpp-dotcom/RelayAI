"use client";

import React, { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { 
  Zap, 
  LogOut, 
  Plus, 
  MessageSquare,
  Sparkles,
  Globe,
  Mail,
  Clock,
  Inbox as InboxIcon,
  Terminal,
  Settings as SettingsIcon,
  User as UserIcon,
  ChevronDown,
  ChevronRight
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

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [olderExpanded, setOlderExpanded] = useState(false);

  useEffect(() => {
    // Client-side cache check to prevent hydration mismatch
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

  // Helper to group conversations by date
  const getGroupedConversations = () => {
    const groups: { [key: string]: Conversation[] } = {
      Today: [],
      Yesterday: [],
      "Previous 7 Days": [],
      Older: [],
    };

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    
    const startOf7DaysAgo = new Date(startOfToday);
    startOf7DaysAgo.setDate(startOf7DaysAgo.getDate() - 7);

    conversations.forEach((conv) => {
      const date = new Date(conv.lastMessageAt || conv.updatedAt || conv.createdAt);
      if (date >= startOfToday) {
        groups.Today.push(conv);
      } else if (date >= startOfYesterday) {
        groups.Yesterday.push(conv);
      } else if (date >= startOf7DaysAgo) {
        groups["Previous 7 Days"].push(conv);
      } else {
        groups.Older.push(conv);
      }
    });

    return groups;
  };

  const formatTimestamp = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    
    // Check if today
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    
    // Older
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const groupedConvs = getGroupedConversations();
  const hasConversations = conversations.length > 0;

  const capabilities = [
    { label: "Briefing", route: "/briefing", icon: <Sparkles size={13} /> },
    { label: "Orbits", route: "/opportunities", icon: <Globe size={13} /> },
    { label: "Outreach", route: "/outreach", icon: <Mail size={13} /> },
    { label: "Follow-ups", route: "/follow-ups", icon: <Clock size={13} /> },
    { label: "Inbox", route: "/gmail", icon: <InboxIcon size={13} /> },
    { label: "API Monitor", route: "/api", icon: <Terminal size={13} /> },
    { label: "Settings", route: "/settings", icon: <SettingsIcon size={13} /> },
    { label: "Profile", route: "/profile", icon: <UserIcon size={13} /> },
  ];

  return (
    <aside className="w-80 h-full border-r border-white/10 bg-black flex flex-col justify-between py-6 shrink-0 z-30 select-none">
      
      {/* 1. Header: Compact Logo & Brand */}
      <div className="flex flex-col shrink-0 w-full gap-4">
        {/* Compact Logo & Brand */}
        <div className="flex items-center gap-2.5 px-6 select-none group">
          <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center transition-all duration-300 group-hover:scale-105">
            <Zap size={13} className="text-white fill-white/10 transition-transform duration-300 group-hover:scale-110" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold tracking-[0.16em] font-heading text-white transition-all duration-300">RELAY AI</span>
            <span className="text-[8px] font-sans font-bold tracking-[0.18em] text-zinc-500 -mt-1 uppercase">OPPORTUNITY ORBIT</span>
          </div>
        </div>

        {/* 2. New Conversation Action Button */}
        <div className="px-4">
          <Link
            href="/briefing"
            className="relative group flex items-center justify-center gap-2 w-full py-2 px-4 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 active:scale-[0.98] transition-all duration-300 overflow-hidden shadow-sm"
          >
            <Plus size={14} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>New Conversation</span>
          </Link>
        </div>
      </div>

      {/* 3. Capabilities Section */}
      <div className="flex flex-col shrink-0 w-full px-3 mt-6">
        <h3 className="px-3 mb-1.5 text-[10px] font-sans font-semibold tracking-[0.12em] text-zinc-500 uppercase select-none">
          Workspace
        </h3>
        <div className="space-y-1">
          {capabilities.map((cap) => {
            const isActive = pathname === cap.route;
            return (
              <Link
                key={cap.label}
                href={cap.route}
                className={cn(
                  "relative flex items-center gap-2.5 px-3 h-10 rounded-xl text-[12px] font-sans tracking-wide transition-all duration-200 group truncate w-full z-10",
                  isActive
                    ? "text-white font-medium bg-white/[0.04] border border-white/[0.06]"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-nav-indicator"
                    className="absolute left-0 w-0.5 h-4 bg-white rounded-r-md"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <div className={cn(
                  "shrink-0 transition-colors duration-200",
                  isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                )}>
                  {cap.icon}
                </div>
                <span className="truncate flex-1 text-left">{cap.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-4 my-4 shrink-0" />

      {/* 4. Independent Scrollable Conversation List */}
      <div className="flex-1 overflow-y-auto px-3 space-y-5 my-2 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent min-h-0">
        <h3 className="px-3 mb-2 text-[10px] font-sans font-semibold tracking-[0.12em] text-zinc-500 uppercase select-none">
          Conversations
        </h3>
        {loading ? (
          <div className="space-y-2 px-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 w-full bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !hasConversations ? (
          <div className="px-3 py-4 text-center text-xs text-zinc-650 font-mono">
            No conversations yet.
          </div>
        ) : (
          Object.entries(groupedConvs).map(([groupName, items]) => {
            if (items.length === 0) return null;

            if (groupName === "Older") {
              return (
                <div key={groupName} className="space-y-1">
                  <button
                    onClick={() => setOlderExpanded(!olderExpanded)}
                    className="flex items-center justify-between w-full px-3 py-1 text-[9px] font-sans font-bold tracking-[0.12em] text-zinc-500 hover:text-zinc-300 uppercase select-none cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-zinc-800" />
                      <span>{groupName}</span>
                    </div>
                    {olderExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  </button>
                  <AnimatePresence initial={false}>
                    {olderExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-0.5 overflow-hidden"
                      >
                        {items.map((conv) => {
                          const isActive = pathname === `/c/${conv.id}`;
                          return (
                            <Link
                              key={conv.id}
                              href={`/c/${conv.id}`}
                              className={cn(
                                "relative flex items-center justify-between gap-3 px-3 h-12 rounded-xl text-xs transition-all duration-200 group w-full z-10",
                                isActive
                                  ? "bg-white/[0.05] text-white font-medium"
                                  : "text-zinc-400 hover:text-white hover:bg-white/[0.02]"
                              )}
                            >
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <MessageSquare size={13} className={cn(
                                  "shrink-0 mt-0.5 transition-colors duration-200",
                                  isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-400"
                                )} />
                                <span className="line-clamp-2 text-left leading-snug text-[11.5px] font-sans tracking-wide break-words">{conv.title || "Untitled Conversation"}</span>
                              </div>
                              <span className="text-[9px] text-zinc-550 shrink-0 font-mono tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                {formatTimestamp(conv.lastMessageAt || conv.updatedAt || conv.createdAt)}
                              </span>
                            </Link>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            return (
              <div key={groupName} className="space-y-1">
                <div className="flex items-center gap-1.5 px-3 py-1 text-[9px] font-sans font-bold tracking-[0.12em] text-zinc-500 uppercase select-none">
                  <span className="w-1 h-1 rounded-full bg-zinc-800" />
                  <span>{groupName}</span>
                </div>
                <div className="space-y-0.5">
                  {items.map((conv) => {
                    const isActive = pathname === `/c/${conv.id}`;
                    return (
                      <Link
                        key={conv.id}
                        href={`/c/${conv.id}`}
                        className={cn(
                          "relative flex items-center justify-between gap-3 px-3 h-12 rounded-xl text-xs transition-all duration-200 group w-full z-10",
                          isActive
                            ? "bg-white/[0.05] text-white font-medium"
                            : "text-zinc-400 hover:text-white hover:bg-white/[0.02]"
                        )}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <MessageSquare size={13} className={cn(
                            "shrink-0 mt-0.5 transition-colors duration-200",
                            isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                          )} />
                          <span className="line-clamp-2 text-left leading-snug text-[11.5px] font-sans tracking-wide break-words">{conv.title || "Untitled Conversation"}</span>
                        </div>
                        <span className="text-[9px] text-zinc-500 shrink-0 font-mono tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          {formatTimestamp(conv.lastMessageAt || conv.updatedAt || conv.createdAt)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Profile Row */}
      <div className="mt-auto px-4 pt-4 border-t border-white/10 shrink-0 w-full flex items-center justify-between gap-3 bg-black">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden select-none">
            {session?.user?.image ? (
              <img src={session.user.image} alt={session.user.name || "User"} className="w-full h-full object-cover" />
            ) : (
              <span>{session?.user?.name?.charAt(0).toUpperCase() || "U"}</span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-white tracking-wide truncate leading-none">
              {session?.user?.name || "Founder"}
            </span>
            <span className="text-[10px] text-zinc-500 truncate mt-1.5 leading-none font-mono tracking-wide">
              {session?.user?.email || "founder@relay.ai"}
            </span>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 cursor-pointer shrink-0"
          title="Sign Out"
        >
          <LogOut size={14} />
        </button>
      </div>

    </aside>
  );
}

export default Sidebar;
