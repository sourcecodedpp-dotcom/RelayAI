"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Sparkles, 
  Mail, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  Filter,
  Check,
  Search
} from "lucide-react";
import Link from "next/link";

interface Opportunity {
  id: string;
  type: "FOLLOW_UP_DUE" | "INVESTOR_REPLIED" | "NEW_CONTACT_DISCOVERED";
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  priorityScore: number;
  contactId?: string;
  contact?: {
    name: string;
    role: string;
    company: string;
  };
}

export default function OpportunitiesPage() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<string>("ALL");

  // Load Opportunities
  const { data: opportunities = [], isLoading, error } = useQuery<Opportunity[]>({
    queryKey: ["opportunities"],
    queryFn: async () => {
      const res = await fetch("/api/opportunities");
      if (!res.ok) throw new Error("Failed to load opportunities.");
      return res.json();
    },
  });

  // Mutate Resolve Opportunity
  const resolveOpportunity = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "COMPLETED" | "DISMISSED" }) => {
      const res = await fetch(`/api/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to resolve opportunity.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });

  const getOpportunityIcon = (type: string) => {
    switch (type) {
      case "INVESTOR_REPLIED":
        return <Mail size={16} className="text-zinc-300" />;
      case "FOLLOW_UP_DUE":
        return <Calendar size={16} className="text-zinc-400" />;
      default:
        return <Sparkles size={16} className="text-zinc-500" />;
    }
  };

  const filtered = filterType === "ALL" 
    ? opportunities 
    : opportunities.filter((o) => o.type === filterType);

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col gap-8">
      <header className="flex flex-col gap-1.5 mt-4">
        <div className="text-xs font-mono uppercase tracking-widest text-primary font-bold">
          Workspace Actions
        </div>
        <h1 className="text-4xl font-heading font-extrabold text-white tracking-tight">
          Opportunities Hub
        </h1>
        <p className="text-gray-400 text-sm font-body">
          Filter and audit relationship opportunities compiled by your briefing engine. Keep the feed clear to stay on track.
        </p>
      </header>

      {/* Filters Toolbar */}
      <div className="flex gap-2 items-center flex-wrap bg-white/2 p-2 rounded-xl border border-white/5">
        <div className="text-xs text-gray-500 font-mono px-3 flex items-center gap-1">
          <Filter size={12} />
          Filter:
        </div>
        
        {["ALL", "INVESTOR_REPLIED", "FOLLOW_UP_DUE", "NEW_CONTACT_DISCOVERED"].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
              filterType === type 
                ? "bg-primary text-zinc-950 font-bold" 
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {type === "ALL" ? "Show All" : type.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="h-32 bg-white/5 border border-white/10 rounded-xl animate-pulse" />
      )}

      {error && (
        <div className="p-6 glass-card rounded-xl border border-zinc-800 text-zinc-400 flex gap-2 items-center text-sm">
          <AlertCircle size={16} />
          <span>Failed to load opportunities feed.</span>
        </div>
      )}

      {!isLoading && !error && (
        <div className="flex flex-col gap-3">
          {filtered.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-white/10 rounded-xl bg-white/2 text-sm text-gray-500">
              No opportunities match the selected filter.
            </div>
          ) : (
            filtered.map((opp) => (
              <div
                key={opp.id}
                className="p-4 bg-white/2 hover:bg-white/5 border border-white/5 rounded-xl flex items-center justify-between gap-6 transition"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-white/5 mt-0.5">
                    {getOpportunityIcon(opp.type)}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <h3 className="text-sm font-bold text-white">{opp.title}</h3>
                    <p className="text-xs text-gray-400 max-w-2xl font-body mt-0.5 leading-relaxed">
                      {opp.description}
                    </p>
                    {opp.contact && (
                      <span className="text-[10px] text-gray-500 font-mono mt-1">
                        Target: {opp.contact.name} ({opp.contact.role} @ {opp.contact.company})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => resolveOpportunity.mutate({ id: opp.id, status: "COMPLETED" })}
                    className="p-1.5 hover:bg-cta/20 text-gray-500 hover:text-cta rounded-md cursor-pointer transition"
                    title="Mark Resolved"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => resolveOpportunity.mutate({ id: opp.id, status: "DISMISSED" })}
                    className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-white rounded-md cursor-pointer hover:bg-white/5 transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
