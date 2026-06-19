"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Terminal, 
  Database, 
  Cpu, 
  RefreshCw, 
  Link2,
  Settings,
  Key,
  Shield,
  Activity,
  CheckCircle2,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { toast } from "@/lib/toast";

interface MonitorData {
  db: {
    status: string;
    latencyMs: number;
    counts: {
      contacts: number;
      opportunities: number;
      goals: number;
      followups: number;
    };
  };
  google: {
    status: string;
    email: string | null;
  };
  mercury: {
    status: string;
    model: string;
    latencyMs: number | null;
    error: string | null;
    provider: string;
  };
  logs: Array<{
    id: string;
    action: string;
    details: string;
    userAgent: string | null;
    createdAt: string;
  }>;
}

interface ProvidersData {
  connections: Record<string, { connected: boolean; lastVerifiedAt: string | null }>;
  defaultProvider: string;
  defaultModel: string;
  models: Record<string, Array<{ model: string; name?: string; maxContextTokens: number }>>;
}

export default function ApiMonitorPage() {
  const queryClient = useQueryClient();

  // Fetch connection diagnostics
  const { data, isLoading, isRefetching, refetch } = useQuery<MonitorData>({
    queryKey: ["api-monitor"],
    queryFn: async () => {
      const res = await fetch("/api/api-monitor");
      if (!res.ok) throw new Error("Failed to fetch API diagnostics.");
      return res.json();
    },
    refetchInterval: 15000, // Auto-refresh every 15s
  });

  // Fetch AI providers data
  const { data: providersData, isLoading: isLoadingProviders, refetch: refetchProviders } = useQuery<ProvidersData>({
    queryKey: ["ai-providers"],
    queryFn: async () => {
      const res = await fetch("/api/providers");
      if (!res.ok) throw new Error("Failed to fetch AI providers.");
      return res.json();
    }
  });

  const [keys, setKeys] = useState<Record<string, string>>({
    gemini: "",
    openai: "",
    anthropic: "",
    openrouter: "",
  });

  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({
    gemini: "gemini-2.5-pro",
    openai: "gpt-4o",
    anthropic: "claude-3-5-sonnet-latest",
    openrouter: "",
  });

  const [connecting, setConnecting] = useState<Record<string, boolean>>({
    gemini: false,
    openai: false,
    anthropic: false,
    openrouter: false,
  });

  const [disconnecting, setDisconnecting] = useState<Record<string, boolean>>({
    gemini: false,
    openai: false,
    anthropic: false,
    openrouter: false,
  });

  const [settingDefault, setSettingDefault] = useState<Record<string, boolean>>({
    system: false,
    gemini: false,
    openai: false,
    anthropic: false,
    openrouter: false,
  });

  const handleManualRefresh = async () => {
    await refetch();
    await refetchProviders();
    toast("Diagnostics refreshed.", "success");
  };

  const handleConnect = async (provider: string) => {
    const key = keys[provider]?.trim();
    if (!key) {
      toast("Please enter an API key.", "error");
      return;
    }

    setConnecting(prev => ({ ...prev, [provider]: true }));
    try {
      const res = await fetch("/api/providers/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: key }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || "Connection failed.");
      }
      toast(`${provider.toUpperCase()} API key connected successfully.`, "success");
      setKeys(prev => ({ ...prev, [provider]: "" }));
      await refetchProviders();
      queryClient.invalidateQueries({ queryKey: ["api-monitor"] });
    } catch (err: any) {
      toast(err.message || "Failed to connect provider.", "error");
    } finally {
      setConnecting(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleDisconnect = async (provider: string) => {
    setDisconnecting(prev => ({ ...prev, [provider]: true }));
    try {
      const res = await fetch("/api/providers/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || "Failed to disconnect.");
      }
      toast(`${provider.toUpperCase()} API key disconnected.`, "success");
      await refetchProviders();
      queryClient.invalidateQueries({ queryKey: ["api-monitor"] });
    } catch (err: any) {
      toast(err.message || "Failed to disconnect.", "error");
    } finally {
      setDisconnecting(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleSetDefault = async (provider: string) => {
    // Resolve model to save
    let model = "";
    if (provider === "system") {
      model = "mercury-2";
    } else {
      model = selectedModels[provider] || providersData?.models[provider]?.[0]?.model || "";
    }

    if (!model) {
      toast("No model selected or available.", "error");
      return;
    }

    setSettingDefault(prev => ({ ...prev, [provider]: true }));
    try {
      const res = await fetch("/api/providers/default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || "Failed to update default.");
      }
      toast(`Default model updated to ${model} (${provider.toUpperCase()})`, "success");
      await refetchProviders();
    } catch (err: any) {
      toast(err.message || "Failed to update default setting.", "error");
    } finally {
      setSettingDefault(prev => ({ ...prev, [provider]: false }));
    }
  };

  const formatTimestamp = (iso?: string | null) => {
    if (!iso) return "N/A";
    const date = new Date(iso);
    return date.toLocaleString();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 mt-4">
        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-mono uppercase tracking-widest text-white/50 font-bold">
            Diagnostics Console
          </div>
          <h1 className="text-4xl font-heading font-extrabold text-white tracking-tight">
            API & Connection Monitor
          </h1>
          <p className="text-gray-400 text-sm font-body">
            Verify real-time latency, connection statuses, and logs across core systems.
          </p>
        </div>
        
        <button
          onClick={handleManualRefresh}
          disabled={isLoading || isRefetching || isLoadingProviders}
          className="p-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg transition duration-200 cursor-pointer disabled:opacity-40"
          title="Force refresh diagnostics"
        >
          <RefreshCw size={16} className={isRefetching ? "animate-spin" : ""} />
        </button>
      </header>

      {isLoading || isLoadingProviders ? (
        <div className="flex flex-col gap-6 w-full animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-32 bg-white/5 rounded-xl border border-white/5" />
            <div className="h-32 bg-white/5 rounded-xl border border-white/5" />
            <div className="h-32 bg-white/5 rounded-xl border border-white/5" />
          </div>
          <div className="h-64 bg-white/5 rounded-xl border border-white/5" />
        </div>
      ) : (
        <>
          {/* Diagnostic status cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Inception Labs (Mercury-2) */}
            <div className="glass-card p-6 rounded-xl border border-white/10 flex flex-col gap-4 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu size={14} className="text-zinc-400" />
                  Mercury-2 LLM API
                </h3>
                {data?.mercury.status === "ACTIVE" || data?.mercury.status === "MOCK_ACTIVE" ? (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ACTIVE
                  </span>
                ) : data?.mercury.status === "UNAUTHORIZED" ? (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20" title={data.mercury.error || ""}>
                    401 ERROR
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                    ERROR
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 font-mono">MODEL / PROVIDER</span>
                <span className="text-sm font-bold text-white uppercase">{data?.mercury.model} ({data?.mercury.provider})</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 font-mono">LATENCY</span>
                <span className="text-sm font-bold text-white">
                  {data?.mercury.latencyMs ? `${data.mercury.latencyMs}ms` : "N/A (Mocked)"}
                </span>
              </div>
              
              {data?.mercury.error && (
                <p className="text-[10px] text-amber-400 leading-normal font-mono border-t border-white/5 pt-2">
                  ⚠️ {data.mercury.error}
                </p>
              )}
            </div>

            {/* Cloud Firestore */}
            <div className="glass-card p-6 rounded-xl border border-white/10 flex flex-col gap-4 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Database size={14} className="text-zinc-400" />
                  Cloud Firestore
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ONLINE
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 font-mono">LATENCY</span>
                <span className="text-sm font-bold text-white">{data?.db.latencyMs}ms</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 font-mono">COLLECTION RECORDS</span>
                <div className="flex gap-2 text-xs font-mono text-zinc-300 flex-wrap">
                  <span>Contacts: {data?.db.counts.contacts}</span>
                  <span>•</span>
                  <span>Opps: {data?.db.counts.opportunities}</span>
                  <span>•</span>
                  <span>Goals: {data?.db.counts.goals}</span>
                </div>
              </div>
            </div>

            {/* Google OAuth Connection */}
            <div className="glass-card p-6 rounded-xl border border-white/10 flex flex-col gap-4 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Link2 size={14} className="text-zinc-400" />
                  Google Gmail OAuth
                </h3>
                {data?.google.status === "CONNECTED" ? (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    LINKED
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                    UNLINKED
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 font-mono">CONNECTED MAILBOX</span>
                <span className="text-sm font-bold text-white truncate max-w-full">
                  {data?.google.email || "No connected account"}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 font-mono">SCOPES</span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  gmail.send, gmail.readonly, gmail.metadata
                </span>
              </div>
            </div>

          </div>

          {/* BYOK & AI Providers Connect Section */}
          <section className="glass-card p-6 md:p-8 rounded-xl border border-white/10 flex flex-col gap-6 shadow-xl">
            <header className="border-b border-white/5 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Key size={18} className="text-zinc-400" />
                AI Providers & Custom Keys
              </h2>
              <p className="text-xs text-zinc-400 mt-1 font-body">
                Bring Your Own API Key (BYOK) to run Gemini, OpenAI, Anthropic, or OpenRouter. All keys are encrypted server-side using AES-256-GCM.
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Relay Cloud (Mercury-2) - built-in */}
              <div className="p-5 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-bold text-white">Relay Cloud (System)</h4>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      BUILT-IN
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Relay's default fallbacks. Powered by Inception Labs mercury-2. Active out of the box.
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <span className="text-[10px] font-mono text-zinc-400">
                    {providersData?.defaultProvider === "system" ? "Active Default" : "System Fallback"}
                  </span>
                  {providersData?.defaultProvider !== "system" ? (
                    <button
                      onClick={() => handleSetDefault("system")}
                      disabled={settingDefault["system"]}
                      className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white rounded transition cursor-pointer"
                    >
                      {settingDefault["system"] ? "Setting..." : "Set as Default"}
                    </button>
                  ) : (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 size={12} /> DEFAULT
                    </span>
                  )}
                </div>
              </div>

              {/* Loop through custom providers: gemini, openai, anthropic, openrouter */}
              {["gemini", "openai", "anthropic", "openrouter"].map((provider) => {
                const conn = providersData?.connections?.[provider] || { connected: false, lastVerifiedAt: null };
                const models = providersData?.models?.[provider] || [];
                const isDefault = providersData?.defaultProvider === provider;
                const activeModel = providersData?.defaultModel;

                return (
                  <div key={provider} className="p-5 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col justify-between gap-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm font-bold text-white capitalize">{provider === "openai" ? "OpenAI" : provider}</h4>
                        {conn.connected ? (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            CONNECTED
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                            DISCONNECTED
                          </span>
                        )}
                      </div>

                      {conn.connected ? (
                        <div className="flex flex-col gap-2">
                          <p className="text-[10px] text-zinc-400">
                            Last verified: <span className="text-zinc-300">{formatTimestamp(conn.lastVerifiedAt)}</span>
                          </p>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] text-zinc-500 font-mono">DEFAULT MODEL FOR THIS PROVIDER</label>
                            <select
                              value={selectedModels[provider] || activeModel || ""}
                              onChange={(e) => setSelectedModels(prev => ({ ...prev, [provider]: e.target.value }))}
                              className="bg-black/50 border border-white/10 text-white rounded px-2 py-1 text-xs focus:outline-none"
                            >
                              {models.map((m) => (
                                <option key={m.model} value={m.model} className="bg-black">
                                  {m.name || m.model}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] text-zinc-400 font-mono">ENTER API KEY</label>
                          <input
                            type="password"
                            placeholder={`${provider.toUpperCase()} API Key`}
                            value={keys[provider]}
                            onChange={(e) => setKeys(prev => ({ ...prev, [provider]: e.target.value }))}
                            className="bg-black/50 border border-white/10 text-white rounded px-3 py-1.5 text-xs w-full focus:outline-none placeholder:text-zinc-600"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1">
                      {conn.connected ? (
                        <>
                          <button
                            onClick={() => handleDisconnect(provider)}
                            disabled={disconnecting[provider]}
                            className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 transition"
                          >
                            <Trash2 size={12} /> Disconnect
                          </button>

                          {isDefault ? (
                            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 size={12} /> DEFAULT
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSetDefault(provider)}
                              disabled={settingDefault[provider]}
                              className="px-3 py-1 text-xs bg-white/5 hover:bg-white/10 text-white rounded transition"
                            >
                              {settingDefault[provider] ? "Saving..." : "Set as Default"}
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] text-zinc-500 font-mono">Key is encrypted</span>
                          <button
                            onClick={() => handleConnect(provider)}
                            disabled={connecting[provider] || !keys[provider]}
                            className="px-3 py-1 bg-white text-black hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed rounded text-xs font-medium transition"
                          >
                            {connecting[provider] ? "Testing..." : "Connect"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Security & System Settings Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            
            {/* System specifications */}
            <div className="md:col-span-1 flex flex-col gap-6">
              <div className="glass-card p-6 rounded-xl border border-white/10 flex flex-col gap-4">
                <h3 className="text-sm font-mono text-zinc-400 uppercase flex items-center gap-1.5">
                  <Shield size={14} className="text-zinc-500" />
                  Security Specifications
                </h3>
                
                <div className="flex flex-col gap-2.5 text-[11px] font-mono text-zinc-400">
                  <div className="flex justify-between border-b border-white/5 pb-1.5">
                    <span>ENCRYPTION</span>
                    <span className="text-white">AES-256-GCM</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1.5">
                    <span>HASH METHOD</span>
                    <span className="text-white">HMAC-SHA256</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1.5">
                    <span>RATE LIMIT</span>
                    <span className="text-white">100 REQ/MIN</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TENANT GUARD</span>
                    <span className="text-white">STRICT ISOLATED</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Audit Logs terminal */}
            <div className="md:col-span-2">
              <div className="glass-card p-6 md:p-8 rounded-xl border border-white/10 flex flex-col gap-5 shadow-xl">
                <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
                  <Terminal size={18} className="text-zinc-500" />
                  Security Audit Logs
                </h2>

                <div className="bg-black/40 border border-white/5 rounded-xl p-4 font-mono text-xs flex flex-col gap-3 min-h-[160px] max-h-[300px] overflow-y-auto">
                  {data?.logs && data.logs.length > 0 ? (
                    data.logs.map((log) => (
                      <div key={log.id} className="flex gap-3 items-start leading-relaxed border-b border-white/5 pb-2 last:border-0 last:pb-0">
                        <span className="text-zinc-500 shrink-0">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex gap-2 items-center">
                            <span className="font-bold text-white bg-white/5 px-1.5 py-0.5 rounded text-[10px]">
                              {log.action}
                            </span>
                            <span className="text-[10px] text-zinc-400 truncate max-w-[250px]" title={log.userAgent || ""}>
                              {log.userAgent || "System Process"}
                            </span>
                          </div>
                          <p className="text-zinc-300 text-[11px] mt-1 break-all">
                            {log.details}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-zinc-600 text-center py-8">
                      No security audit events recorded.
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
