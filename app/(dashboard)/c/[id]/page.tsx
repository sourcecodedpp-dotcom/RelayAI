"use client";

import { useEffect, useRef, useCallback, useTransition } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
    Paperclip,
    SendIcon,
    XIcon,
    Sparkles,
    Command,
    Globe,
    Mail,
    Clock,
    Settings,
    Inbox,
    Terminal,
    User,
    ChevronLeft,
    ChevronDown,
    ChevronRight,
    Brain,
    FileUp,
    AlertTriangle,
} from "lucide-react";
import { LemniscateLoader } from "@/components/lemniscate-loader";
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "@/lib/toast";
import Link from "next/link";

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            if (reset) {
                textarea.style.height = `${minHeight}px`;
                return;
            }

            textarea.style.height = `${minHeight}px`;
            const newHeight = Math.max(
                minHeight,
                Math.min(
                    textarea.scrollHeight,
                    maxHeight ?? Number.POSITIVE_INFINITY
                )
            );

            textarea.style.height = `${newHeight}px`;
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = `${minHeight}px`;
        }
    }, [minHeight]);

    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

interface CommandSuggestion {
    icon: React.ReactNode;
    label: string;
    description: string;
    prefix: string;
}

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  containerClassName?: string;
  showRing?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, showRing = true, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    
    return (
      <div className={cn(
        "relative",
        containerClassName
      )}>
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "transition-all duration-200 ease-in-out",
            "placeholder:text-muted-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
            showRing ? "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0" : "",
            className
          )}
          ref={ref}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        
        {showRing && isFocused && (
          <motion.span 
            className="absolute inset-0 rounded-md pointer-events-none ring-2 ring-offset-0 ring-violet-500/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}

        {props.onChange && (
          <div 
            className="absolute bottom-2 right-2 opacity-0 w-2 h-2 bg-violet-500 rounded-full"
            style={{
              animation: 'none',
            }}
            id="textarea-ripple"
          />
        )}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

function MarkdownRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  let inList = false;
  const renderedElements: React.ReactNode[] = [];

  const parseInline = (str: string): React.ReactNode[] => {
    const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={idx} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={idx} className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-xs">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const listItems: React.ReactNode[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!inList) {
        inList = true;
      }
      listItems.push(
        <li key={index} className="ml-4 list-disc mb-1 pl-1">
          {parseInline(trimmed.substring(2))}
        </li>
      );
    } else {
      if (inList) {
        renderedElements.push(
          <ul key={`list-${index}`} className="my-2 space-y-1">
            {[...listItems]}
          </ul>
        );
        listItems.length = 0;
        inList = false;
      }

      if (trimmed === "") {
        renderedElements.push(<div key={index} className="h-2" />);
      } else if (trimmed.startsWith("### ")) {
        renderedElements.push(
          <h4 key={index} className="text-base font-bold text-white mt-3 mb-1.5">
            {parseInline(trimmed.substring(4))}
          </h4>
        );
      } else if (trimmed.startsWith("## ")) {
        renderedElements.push(
          <h3 key={index} className="text-lg font-bold text-white mt-4 mb-2">
            {parseInline(trimmed.substring(3))}
          </h3>
        );
      } else if (trimmed.startsWith("# ")) {
        renderedElements.push(
          <h2 key={index} className="text-xl font-bold text-white mt-5 mb-3">
            {parseInline(trimmed.substring(2))}
          </h2>
        );
      } else {
        renderedElements.push(
          <p key={index} className="mb-2 leading-relaxed">
            {parseInline(trimmed)}
          </p>
        );
      }
    }
  });

  if (inList) {
    renderedElements.push(
      <ul key="list-final" className="my-2 space-y-1">
        {listItems}
      </ul>
    );
  }

  return <div className="space-y-1 text-sm font-body text-zinc-100">{renderedElements}</div>;
}

function ThinkingTrace({ steps }: { steps: any[] }) {
    const [isOpen, setIsOpen] = useState(false);

    if (!steps || steps.length === 0) return null;

    const lastStep = steps[steps.length - 1];
    const isError = steps.some(s => s.isError || s.type === "error");
    const activeStep = lastStep?.text;
    const stepCount = steps.length;

    const getElapsed = (step: any, idx: number) => {
        if (step.createdAt && steps[0].createdAt) {
            try {
                const diff = new Date(step.createdAt).getTime() - new Date(steps[0].createdAt).getTime();
                if (!isNaN(diff)) {
                    return `+${(diff / 1000).toFixed(1)}s`;
                }
            } catch (e) {}
        }
        return `+${(idx * 0.4).toFixed(1)}s`;
    };

    return (
        <div className="w-full my-2 flex justify-start select-none">
            <div className="w-full max-w-[90%] md:max-w-[85%] rounded-lg border border-zinc-800/80 bg-zinc-950/25 hover:bg-zinc-950/35 transition-all duration-200 overflow-hidden backdrop-blur-sm">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-zinc-400 font-mono transition-colors duration-150"
                >
                    <div className="flex items-center gap-2">
                        {isOpen ? (
                            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                        ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                        <span className="font-semibold text-zinc-300 font-mono tracking-tight text-[11px]">Swarm Trace</span>
                        <span className="text-[9px] px-1 rounded bg-zinc-800/60 text-zinc-500 font-medium">
                            {stepCount} {stepCount === 1 ? "step" : "steps"}
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {isError ? (
                            <span className="text-[10px] text-red-400 font-bold flex items-center gap-1 font-mono">
                                <AlertTriangle className="w-3 h-3 animate-pulse" /> FAILED
                            </span>
                        ) : (
                            <span className="text-[10px] text-zinc-500 truncate max-w-[200px] md:max-w-xs italic font-mono">
                                {isOpen ? "Details expanded" : activeStep}
                            </span>
                        )}
                    </div>
                </button>

                <AnimatePresence initial={false}>
                    {isOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15, ease: "easeInOut" }}
                            className="border-t border-zinc-900/60 bg-zinc-950/45"
                        >
                            <div className="py-1">
                                {steps.map((step, idx) => {
                                    let tag = "info";
                                    let content = step.text;
                                    let dotType = step.type || "info";

                                    if (content.startsWith("Autonomous Swarm Initialized:")) {
                                        tag = "swarm";
                                        dotType = "swarm";
                                        content = content.replace("Autonomous Swarm Initialized:", "").trim();
                                    } else if (content.startsWith("Search Scout:")) {
                                        tag = "search";
                                        dotType = "search";
                                        content = content.replace("Search Scout:", "").trim();
                                    } else if (content.startsWith("Integrator: Contact record")) {
                                        tag = "db";
                                        dotType = "integrator";
                                        content = content.replace("Integrator:", "").trim();
                                    } else if (content.startsWith("Integrator: Outreach email")) {
                                        tag = "email";
                                        dotType = "gmail";
                                        content = content.replace("Integrator:", "").trim();
                                    } else if (content.startsWith("Integrator: Scheduled follow-up")) {
                                        tag = "task";
                                        dotType = "follow_up";
                                        content = content.replace("Integrator:", "").trim();
                                    } else if (content.startsWith("Integrator:")) {
                                        tag = "integrator";
                                        dotType = "integrator";
                                        content = content.replace("Integrator:", "").trim();
                                    } else if (step.type === "thought" || content.startsWith("Thought:")) {
                                        tag = "thought";
                                        dotType = "thought";
                                        content = content.replace(/^Thought:\s*/, "").trim();
                                    } else if (step.type === "error" || step.isError) {
                                        tag = "error";
                                        dotType = "error";
                                    }

                                    let tagColorClass = "text-zinc-500";
                                    let dotColorClass = "bg-zinc-600";
                                    let textColorClass = "text-zinc-300";

                                    if (dotType === "swarm") {
                                        tagColorClass = "text-purple-400/90";
                                        dotColorClass = "bg-purple-500/80";
                                    } else if (dotType === "search") {
                                        tagColorClass = "text-emerald-400/90";
                                        dotColorClass = "bg-emerald-500/80";
                                    } else if (dotType === "integrator") {
                                        tagColorClass = "text-blue-400/90";
                                        dotColorClass = "bg-blue-500/80";
                                    } else if (dotType === "gmail") {
                                        tagColorClass = "text-cyan-400/90";
                                        dotColorClass = "bg-cyan-500/80";
                                    } else if (dotType === "follow_up") {
                                        tagColorClass = "text-violet-400/90";
                                        dotColorClass = "bg-violet-500/80";
                                    } else if (dotType === "thought") {
                                        tagColorClass = "text-zinc-650";
                                        dotColorClass = "bg-zinc-700";
                                        textColorClass = "text-zinc-500 italic";
                                    } else if (dotType === "error") {
                                        tagColorClass = "text-red-400/90";
                                        dotColorClass = "bg-red-500/80 animate-pulse";
                                        textColorClass = "text-red-300/80";
                                    }

                                    const elapsed = getElapsed(step, idx);
                                    const isFirst = idx === 0;
                                    const isLast = idx === steps.length - 1;

                                    return (
                                        <div key={idx} className="flex items-center py-1.5 hover:bg-white/[0.01] transition-colors font-mono">
                                            {/* Timestamp & Tag */}
                                            <div className="w-[105px] shrink-0 flex items-center justify-between pr-3 select-none text-[9px]">
                                                <span className="text-zinc-650 pl-2.5 font-medium">{elapsed}</span>
                                                <span className={cn("font-bold tracking-widest text-[9px] uppercase", tagColorClass)}>{tag}</span>
                                            </div>
                                            
                                            {/* Timeline Dot & Line */}
                                            <div className="relative w-3 self-stretch flex items-center justify-center shrink-0">
                                                <div className={cn(
                                                    "absolute left-1/2 w-[1px] bg-zinc-800/85",
                                                    isFirst && isLast ? "hidden" : isFirst ? "top-1/2 bottom-0" : isLast ? "top-0 bottom-1/2" : "top-0 bottom-0"
                                                )} style={{ transform: 'translateX(-50%)' }} />
                                                <div className={cn("absolute w-1.5 h-1.5 rounded-full z-10 border border-zinc-950", dotColorClass)} />
                                            </div>
                                            
                                            {/* Content */}
                                            <div className="flex-1 pl-3.5 min-w-0 pr-3">
                                                <span className={cn("text-[10.5px] leading-relaxed break-words font-mono block", textColorClass)}>
                                                    {content}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default function ConversationPage() {
    const router = useRouter();
    const params = useParams();
    const conversationId = params.id as string;

    const [conversation, setConversation] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [value, setValue] = useState("");
    const [attachments, setAttachments] = useState<Array<{ name: string; size: number; type: string; content: string }>>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [recentCommand, setRecentCommand] = useState<string | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 40,
        maxHeight: 120,
    });
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [inputFocused, setInputFocused] = useState(false);
    const commandPaletteRef = useRef<HTMLDivElement>(null);
    
    // Providers states
    const [selectedProvider, setSelectedProvider] = useState("system");
    const [selectedModel, setSelectedModel] = useState("mercury-2");
    const [providersData, setProvidersData] = useState<any>(null);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [showFallbackModal, setShowFallbackModal] = useState(false);
    const [fallbackMessage, setFallbackMessage] = useState("");

    // Load provider choices
    useEffect(() => {
        const fetchProviders = async () => {
            try {
                const res = await fetch("/api/providers");
                if (res.ok) {
                    const pData = await res.json();
                    setProvidersData(pData);
                }
            } catch (err) {
                console.error("Failed to fetch providers:", err);
            }
        };
        fetchProviders();
    }, []);

    // Global Cmd+K / Ctrl+K keyboard shortcut
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setShowCommandPalette(prev => !prev);
            }
        };
        window.addEventListener("keydown", handleGlobalKeyDown);
        return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }, []);

    // File input handler
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const content = event.target?.result as string || "";
                    setAttachments(prev => [...prev, {
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        content: content
                    }]);
                };
                if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".json") || file.name.endsWith(".csv") || file.name.endsWith(".md") || file.name.endsWith(".ts") || file.name.endsWith(".js")) {
                    reader.readAsText(file);
                } else {
                    reader.readAsDataURL(file);
                }
            });
        }
        e.target.value = '';
    };

    // Messages state mapped directly from messages subcollection
    const [messages, setMessages] = useState<Array<{ 
        sender: "user" | "ai" | "system"; 
        text: string; 
        type?: string;
        actionUrl?: string; 
        isError?: boolean;
        attachments?: Array<{ name: string; size: number; type: string }>;
    }>>([]);

    const commandSuggestions: CommandSuggestion[] = [
        { 
            icon: <Sparkles className="w-4 h-4" />, 
            label: "Home", 
            description: "Go to home chat screen", 
            prefix: "/" 
        },
        { 
            icon: <Mail className="w-4 h-4" />, 
            label: "Outreach", 
            description: "Draft outreach drafts & follow-ups", 
            prefix: "/outreach" 
        },
        { 
            icon: <Clock className="w-4 h-4" />, 
            label: "Follow-ups", 
            description: "Schedule follow-up reminder", 
            prefix: "/followups" 
        },
        { 
            icon: <Settings className="w-4 h-4" />, 
            label: "Settings", 
            description: "Configure options & link Google", 
            prefix: "/settings" 
        },
        { 
            icon: <Inbox className="w-4 h-4" />, 
            label: "Inbox", 
            description: "Show Gmail inbox client", 
            prefix: "/gmail" 
        },
        { 
            icon: <Terminal className="w-4 h-4" />, 
            label: "API Monitor", 
            description: "Check system connection states", 
            prefix: "/api" 
        },
        { 
            icon: <User className="w-4 h-4" />, 
            label: "Profile", 
            description: "Manage your user profile details", 
            prefix: "/profile" 
        },
    ];

    // Load conversation, messages, memory from Firestore
    const loadConversationData = useCallback(async (showIndicator = false) => {
        if (showIndicator) setLoading(true);
        try {
            const res = await fetch(`/api/conversations/${conversationId}`);
            if (!res.ok) throw new Error("Failed to load conversation workspace.");
            const data = await res.json();
            if (data.success) {
                setConversation(data.conversation);
                if (data.conversation?.provider) {
                    setSelectedProvider(data.conversation.provider);
                }
                if (data.conversation?.model) {
                    setSelectedModel(data.conversation.model);
                }
                
                // Hydrate messages from subcollection event log
                const hydratedMessages = (data.messages || []).map((msg: any) => {
                    if (msg.role === "user") {
                        return { 
                            sender: "user" as const, 
                            text: msg.content,
                            attachments: msg.metadata?.attachments || []
                        };
                    } else if (msg.role === "assistant") {
                        return {
                            sender: "ai" as const,
                            text: msg.content,
                            actionUrl: msg.metadata?.actions?.[0]?.url || undefined,
                            isError: msg.metadata?.outcomeType === "error" || undefined
                        };
                    } else {
                        // System badge event
                        return {
                            sender: "system" as const,
                            text: msg.content,
                            type: msg.metadata?.type || "info"
                        };
                    }
                });
                setMessages(hydratedMessages);
            } else {
                toast(data.error || "Workspace error", "error");
            }
        } catch (err: any) {
            toast(err.message || "Failed to load workspace", "error");
        } finally {
            setLoading(false);
        }
    }, [conversationId]);

    useEffect(() => {
        loadConversationData(true);
        
        // Setup polling every 3 seconds to get live background agent chat updates
        const pollInterval = setInterval(() => {
            loadConversationData(false);
        }, 3000);
        
        return () => clearInterval(pollInterval);
    }, [loadConversationData]);

    useEffect(() => {
        if (value.startsWith('/') && !value.includes(' ')) {
            setShowCommandPalette(true);
            
            const matchingSuggestionIndex = commandSuggestions.findIndex(
                (cmd) => cmd.prefix.startsWith(value)
            );
            
            if (matchingSuggestionIndex >= 0) {
                setActiveSuggestion(matchingSuggestionIndex);
            } else {
                setActiveSuggestion(-1);
            }
        } else {
            setShowCommandPalette(false);
        }
    }, [value]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const commandButton = document.querySelector('[data-command-button]');
            
            if (commandPaletteRef.current && 
                !commandPaletteRef.current.contains(target) && 
                !commandButton?.contains(target)) {
                setShowCommandPalette(false);
            }
            // Close model dropdown on outside click
            setShowModelDropdown(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showCommandPalette) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveSuggestion(prev => 
                    prev < commandSuggestions.length - 1 ? prev + 1 : 0
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveSuggestion(prev => 
                    prev > 0 ? prev - 1 : commandSuggestions.length - 1
                );
            } else if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                if (activeSuggestion >= 0) {
                    const selectedCommand = commandSuggestions[activeSuggestion];
                    setValue(selectedCommand.prefix + ' ');
                    setShowCommandPalette(false);
                    
                    setRecentCommand(selectedCommand.label);
                    setTimeout(() => setRecentCommand(null), 3500);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setShowCommandPalette(false);
            }
        } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) {
                handleSendMessage();
            }
        }
    };

    const handleSendMessage = async () => {
        const queryText = value.trim();
        if (!queryText) return;

        // Capture attachments locally to store in message and send
        const currentAttachments = [...attachments];

        // Reset input area immediately like standard chat interfaces
        setValue("");
        setAttachments([]);
        adjustHeight(true);
        setIsTyping(true);

        // Append user query to conversation history locally for responsiveness
        setMessages(prev => [...prev, { 
            sender: "user", 
            text: queryText,
            attachments: currentAttachments.map(att => ({ name: att.name, size: att.size, type: att.type }))
        }]);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    message: queryText, 
                    conversationId,
                    provider: selectedProvider,
                    model: selectedModel,
                    attachments: currentAttachments
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.providerError) {
                    setFallbackMessage(data.message || "Your selected AI provider failed. Switch to Relay Cloud?");
                    setShowFallbackModal(true);
                    setIsTyping(false);
                    return;
                }
                throw new Error(data.error || "Failed to process message.");
            }

            const success = data.success !== false;

            if (success) {
                const routeResult = data.response;
                const message = routeResult.summary || routeResult.message || routeResult.data?.message || "Command executed successfully.";
                const firstAction = routeResult.actions?.[0];
                const actionType = firstAction?.type || routeResult.action;
                const actionUrl = firstAction?.url || routeResult.url;

                setMessages(prev => [...prev, { 
                    sender: "ai", 
                    text: message, 
                    actionUrl: actionType === "redirect" ? actionUrl : undefined 
                }]);

                if (message) {
                    toast(message, "success");
                }

                if (actionType === "redirect" && actionUrl) {
                    // Wait briefly for a smooth animated transition
                    setTimeout(() => {
                        router.push(actionUrl);
                    }, 1500);
                }
            } else {
                const errMsg = data.error || "Error running command.";
                toast(errMsg, "error");
                setMessages(prev => [...prev, { sender: "ai", text: errMsg, isError: true }]);
            }
        } catch (err: any) {
            const errMsg = err.message || "Error running command.";
            toast(errMsg, "error");
            setMessages(prev => [...prev, { sender: "ai", text: errMsg, isError: true }]);
        } finally {
            setIsTyping(false);
            // Re-sync with database to load system events/logs/summary updates
            setTimeout(() => {
                loadConversationData(false);
            }, 600);
        }
    };

    const confirmFallback = async () => {
        setShowFallbackModal(false);
        setSelectedProvider("system");
        setSelectedModel("mercury-2");
        toast("Switched to Relay Cloud fallback.", "success");

        const lastUserMessage = messages[messages.length - 1]?.text;
        if (lastUserMessage) {
            setIsTyping(true);
            try {
                const res = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: lastUserMessage,
                        conversationId,
                        provider: "system",
                        model: "mercury-2"
                    }),
                });

                if (!res.ok) throw new Error("Fallback failed.");
                const data = await res.json();
                const success = data.success !== false;

                if (success) {
                    const routeResult = data.response;
                    const message = routeResult.summary || routeResult.message || routeResult.data?.message || "Command executed successfully.";
                    const firstAction = routeResult.actions?.[0];
                    const actionType = firstAction?.type || routeResult.action;
                    const actionUrl = firstAction?.url || routeResult.url;

                    setMessages(prev => [...prev, { 
                        sender: "ai", 
                        text: message, 
                        actionUrl: actionType === "redirect" ? actionUrl : undefined 
                    }]);

                    if (message) toast(message, "success");
                    if (actionType === "redirect" && actionUrl) {
                        setTimeout(() => { router.push(actionUrl); }, 1500);
                    }
                } else {
                    const errMsg = data.error || "Error running command.";
                    toast(errMsg, "error");
                    setMessages(prev => [...prev, { sender: "ai", text: errMsg, isError: true }]);
                }
            } catch (err: any) {
                const errMsg = err.message || "Error running command.";
                toast(errMsg, "error");
                setMessages(prev => [...prev, { sender: "ai", text: errMsg, isError: true }]);
            } finally {
                setIsTyping(false);
                setTimeout(() => { loadConversationData(false); }, 600);
            }
        }
    };

    const handleAttachFile = () => {
        fileInputRef.current?.click();
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };
    
    const selectCommandSuggestion = (index: number) => {
        const selectedCommand = commandSuggestions[index];
        setValue(selectedCommand.prefix + ' ');
        setShowCommandPalette(false);
        
        setRecentCommand(selectedCommand.label);
        setTimeout(() => setRecentCommand(null), 2000);
    };

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    // Get available models for the dropdown
    const getAvailableModels = () => {
        const models = [
            { id: "mercury-2", name: "Mercury 2", provider: "system" },
            { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
            { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai" },
            { id: "claude-3-5-sonnet", name: "Claude 3.5", provider: "anthropic" },
            { id: "gemini-pro", name: "Gemini Pro", provider: "google" },
        ];
        return models;
    };

    useEffect(() => {
        if (typeof document !== 'undefined') {
            const styleId = "animated-chat-ripple-style";
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.innerHTML = `
@keyframes ripple {
  0% { transform: scale(0.5); opacity: 0.6; }
  100% { transform: scale(2); opacity: 0; }
}
`;
                document.head.appendChild(style);
            }
        }
    }, []);

    if (loading) {
        return (
            <div className="min-h-[calc(100vh-140px)] flex flex-col w-full items-center justify-center bg-transparent text-white p-6 relative">
                <LemniscateLoader size="lg" label="Loading Workspace" className="text-white/60" />
            </div>
        );
    }

    if (!conversation) {
        return (
            <div className="min-h-[calc(100vh-140px)] flex flex-col w-full items-center justify-center bg-transparent text-white p-6 relative">
                <div className="text-center space-y-4 max-w-md mx-auto">
                    <h1 className="text-2xl font-medium tracking-tight text-white/90">Workspace not found</h1>
                    <p className="text-sm text-white/40">This workspace does not exist or you don't have access to it.</p>
                    <Link href="/" className="inline-flex items-center gap-2 mt-4 px-4 py-2 border border-white/10 rounded-lg text-xs font-mono font-bold tracking-wider hover:bg-white/5 transition">
                        <ChevronLeft className="w-4 h-4" /> RETURN TO HOME
                    </Link>
                </div>
            </div>
        );
    }

    // Group consecutive system messages
    const groupedMessages: Array<{
        type: "user" | "ai" | "system-group";
        message?: any;
        steps?: any[];
        key: string;
    }> = [];

    messages.forEach((msg, idx) => {
        if (msg.sender === "system") {
            const lastGroup = groupedMessages[groupedMessages.length - 1];
            if (lastGroup && lastGroup.type === "system-group") {
                lastGroup.steps?.push(msg);
            } else {
                groupedMessages.push({
                    type: "system-group",
                    steps: [msg],
                    key: `sys-group-${idx}`
                });
            }
        } else {
            groupedMessages.push({
                type: msg.sender,
                message: msg,
                key: `msg-${idx}`
            });
        }
    });

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col w-full bg-transparent text-white relative overflow-hidden">

            {/* Scrollable chat area */}
            <div className="flex-1 overflow-y-auto pb-36 pt-4 px-4">
                <div className="w-full max-w-2xl mx-auto relative">
                    {/* Chat Messages */}
                    {messages.length > 0 ? (
                        <div className="space-y-3 flex flex-col select-text w-full">
                            <AnimatePresence initial={false}>
                                {groupedMessages.map((group) => {
                                    if (group.type === "system-group") {
                                        return (
                                            <ThinkingTrace 
                                                key={group.key} 
                                                steps={group.steps || []} 
                                            />
                                        );
                                    }

                                    const msg = group.message;
                                    return (
                                        <motion.div
                                            key={group.key}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.2, ease: "easeOut" }}
                                            className={cn(
                                                "flex w-full gap-2.5 items-start",
                                                msg.sender === "user" ? "justify-end" : "justify-start"
                                            )}
                                        >


                                            <div
                                                className={cn(
                                                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed border relative",
                                                    msg.sender === "user"
                                                        ? "bg-white/[0.06] border-white/[0.08] text-white rounded-tr-sm"
                                                        : msg.isError
                                                            ? "bg-red-950/20 border-red-500/15 text-red-200 rounded-tl-sm"
                                                            : "bg-white/[0.02] border-white/[0.05] text-zinc-200 rounded-tl-sm"
                                                )}
                                            >
                                                {msg.sender === "ai" && msg.isError && (
                                                    <div className="text-[9px] font-mono text-red-400/70 uppercase tracking-widest font-bold mb-1 select-none">
                                                        Error
                                                    </div>
                                                )}

                                                {msg.sender === "ai" ? (
                                                    <MarkdownRenderer text={msg.text} />
                                                ) : (
                                                    <>
                                                        <div className="whitespace-pre-wrap">{msg.text}</div>
                                                        {msg.attachments && msg.attachments.length > 0 && (
                                                            <div className="mt-2.5 flex flex-col gap-1.5 border-t border-white/5 pt-2 select-none">
                                                                {msg.attachments.map((att: any, attIdx: number) => (
                                                                    <div key={attIdx} className="flex items-center gap-1.5 text-xs text-white/50">
                                                                        <Paperclip className="w-3.5 h-3.5 text-white/30" />
                                                                        <span>{att.name}</span>
                                                                        <span className="text-[10px] text-white/25">({Math.round(att.size / 1024)} KB)</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                )}

                                                {msg.actionUrl && (
                                                    <div className="mt-2 pt-2 border-t border-white/5 flex justify-end select-none">
                                                        <Link
                                                            href={msg.actionUrl}
                                                            className="text-[11px] font-semibold text-white/70 hover:text-white flex items-center gap-1 transition"
                                                        >
                                                            Open &rarr;
                                                        </Link>
                                                    </div>
                                                )}
                                            </div>


                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                            <div ref={messagesEndRef} />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
                                <Sparkles className="w-5 h-5 text-white/20" />
                            </div>
                            <p className="text-sm text-white/30 font-medium">Start a conversation</p>
                            <p className="text-xs text-white/15 mt-1">Type below to begin</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Fixed bottom-center input bar — offset by sidebar width dynamically */}
            <div className="fixed bottom-0 left-[var(--sidebar-width)] right-0 z-50 flex justify-center pointer-events-none">
                <div className="w-full max-w-xl pointer-events-auto px-4 pb-5 pt-2">
                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                    />

                    <motion.div 
                        className="relative backdrop-blur-2xl bg-zinc-950/90 rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/50 transition-colors duration-200"
                        initial={{ scale: 0.98, y: 10 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 30 }}
                        style={{
                            boxShadow: inputFocused 
                                ? "0 0 0 1px rgba(255,255,255,0.12), 0 25px 50px -12px rgba(0,0,0,0.5)" 
                                : "0 25px 50px -12px rgba(0,0,0,0.5)"
                        }}
                    >
                        {/* Command palette */}
                        <AnimatePresence>
                            {showCommandPalette && (
                                <motion.div 
                                    ref={commandPaletteRef}
                                    className="absolute left-0 right-0 bottom-full mb-2 backdrop-blur-xl bg-black/95 rounded-xl z-50 shadow-lg border border-white/10 overflow-hidden"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 5 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <div className="py-1">
                                        {commandSuggestions.map((suggestion, index) => (
                                            <motion.div
                                                key={suggestion.prefix}
                                                className={cn(
                                                    "flex items-center gap-2.5 px-3.5 py-2.5 text-xs transition-colors duration-150 cursor-pointer",
                                                    activeSuggestion === index 
                                                        ? "bg-white/10 text-white" 
                                                        : "text-white/70 hover:bg-white/5"
                                                )}
                                                onClick={() => selectCommandSuggestion(index)}
                                            >
                                                <div className="w-4 h-4 flex items-center justify-center text-white/50">
                                                    {suggestion.icon}
                                                </div>
                                                <div className="font-medium text-[11px]">{suggestion.label}</div>
                                                <div className="text-white/30 text-[10px] ml-auto font-mono">
                                                    {suggestion.prefix}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Attachments bar */}
                        <AnimatePresence>
                            {attachments.length > 0 && (
                                <motion.div 
                                    className="px-4 pt-3 pb-0 flex gap-2 flex-wrap"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                >
                                    {attachments.map((file, index) => (
                                        <motion.div
                                            key={index}
                                            className="flex items-center gap-1.5 text-[10px] bg-white/[0.04] py-1.5 px-2.5 rounded-lg text-white/50 border border-white/[0.06] cursor-default"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                        >
                                            <Paperclip className="w-3 h-3 text-white/30" />
                                            <span className="max-w-[120px] truncate">{file.name}</span>
                                            <span className="text-[8px] text-white/20">({Math.round(file.size / 1024)} KB)</span>
                                            <button 
                                                onClick={() => removeAttachment(index)}
                                                className="text-white/25 hover:text-white/60 transition-colors duration-150 cursor-pointer ml-0.5"
                                                aria-label={`Remove ${file.name}`}
                                            >
                                                <XIcon className="w-3 h-3" />
                                            </button>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Textarea — full width */}
                        <div className="px-4 pt-3 pb-1">
                            <Textarea
                                ref={textareaRef}
                                value={value}
                                onChange={(e) => {
                                    setValue(e.target.value);
                                    adjustHeight();
                                }}
                                onKeyDown={handleKeyDown}
                                onFocus={() => setInputFocused(true)}
                                onBlur={() => setInputFocused(false)}
                                placeholder="Ask Relay AI anything..."
                                containerClassName="w-full"
                                className={cn(
                                    "w-full py-1 px-0",
                                    "resize-none",
                                    "bg-transparent",
                                    "border-none",
                                    "text-white/90 text-[14px] leading-relaxed",
                                    "focus:outline-none focus:ring-0 focus-visible:ring-0",
                                    "placeholder:text-white/25",
                                    "min-h-[24px] max-h-[120px]"
                                )}
                                style={{
                                    overflow: "hidden",
                                    boxShadow: "none"
                                }}
                                showRing={false}
                            />
                        </div>

                        {/* Bottom toolbar — single row */}
                        <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
                            {/* Left: actions */}
                            <div className="flex items-center gap-0.5">
                                {/* File attach */}
                                <motion.button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-colors duration-200 cursor-pointer"
                                    title="Attach files"
                                    aria-label="Attach files"
                                >
                                    <FileUp className="w-[18px] h-[18px]" />
                                </motion.button>

                                {/* Divider */}
                                <div className="w-px h-4 bg-white/[0.06] mx-1" />

                                {/* Model selector */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowModelDropdown(!showModelDropdown)}
                                        className="flex items-center gap-1.5 text-[11px] font-mono text-white/35 hover:text-white/60 transition-colors duration-200 py-1.5 px-2 rounded-lg hover:bg-white/[0.04] cursor-pointer"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span className="tracking-wide">{selectedModel}</span>
                                        <ChevronDown className={cn(
                                            "w-3 h-3 transition-transform duration-200",
                                            showModelDropdown && "rotate-180"
                                        )} />
                                    </button>

                                    <AnimatePresence>
                                        {showModelDropdown && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 5 }}
                                                transition={{ duration: 0.15 }}
                                                className="absolute bottom-full left-0 mb-2 w-56 rounded-xl bg-zinc-950 border border-white/10 shadow-2xl p-1.5 z-50 flex flex-col gap-1 backdrop-blur-xl"
                                            >
                                                <div className="px-2 py-1 text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                                                    Select AI Model
                                                </div>
                                                
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedProvider("system");
                                                        setSelectedModel("mercury-2");
                                                        setShowModelDropdown(false);
                                                    }}
                                                    className={cn(
                                                        "w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between",
                                                        selectedModel === "mercury-2" ? "bg-white/10 text-white font-medium" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                                    )}
                                                >
                                                    <span>Relay Cloud (Mercury 2)</span>
                                                    {selectedModel === "mercury-2" && <span className="text-[10px] text-emerald-400">✓</span>}
                                                </button>
                                                
                                                <div className="border-t border-white/5 my-1" />
                                                
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedProvider("gemini");
                                                        setSelectedModel("gemini-2.5-pro");
                                                        setShowModelDropdown(false);
                                                    }}
                                                    className={cn(
                                                        "w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between",
                                                        selectedModel === "gemini-2.5-pro" ? "bg-white/10 text-white font-medium" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                                    )}
                                                >
                                                    <span>Gemini 2.5 Pro</span>
                                                    {selectedModel === "gemini-2.5-pro" && <span className="text-[10px] text-emerald-400">✓</span>}
                                                </button>
                                                
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedProvider("openai");
                                                        setSelectedModel("gpt-4o");
                                                        setShowModelDropdown(false);
                                                    }}
                                                    className={cn(
                                                        "w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between",
                                                        selectedModel === "gpt-4o" ? "bg-white/10 text-white font-medium" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                                    )}
                                                >
                                                    <span>GPT-4o</span>
                                                    {selectedModel === "gpt-4o" && <span className="text-[10px] text-emerald-400">✓</span>}
                                                </button>
                                                
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedProvider("anthropic");
                                                        setSelectedModel("claude-3-5-sonnet-latest");
                                                        setShowModelDropdown(false);
                                                    }}
                                                    className={cn(
                                                        "w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between",
                                                        selectedModel === "claude-3-5-sonnet-latest" ? "bg-white/10 text-white font-medium" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                                    )}
                                                >
                                                    <span>Claude Sonnet</span>
                                                    {selectedModel === "claude-3-5-sonnet-latest" && <span className="text-[10px] text-emerald-400">✓</span>}
                                                </button>

                                                {/* Dynamic OpenRouter models */}
                                                {providersData?.connections?.openrouter?.connected && providersData?.models?.openrouter?.length > 0 && (
                                                    <>
                                                        <div className="border-t border-white/5 my-1" />
                                                        <div className="px-2 py-1 text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                                                            OpenRouter Models
                                                        </div>
                                                        <div className="max-h-36 overflow-y-auto flex flex-col gap-0.5">
                                                            {providersData.models.openrouter.slice(0, 8).map((m: any) => (
                                                                <button
                                                                    key={m.model}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedProvider("openrouter");
                                                                        setSelectedModel(m.model);
                                                                        setShowModelDropdown(false);
                                                                    }}
                                                                    className={cn(
                                                                        "w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between truncate",
                                                                        selectedModel === m.model ? "bg-white/10 text-white font-medium" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                                                    )}
                                                                    title={m.name || m.model}
                                                                >
                                                                    <span className="truncate">{m.name || m.model}</span>
                                                                    {selectedModel === m.model && <span className="text-[10px] text-emerald-400">✓</span>}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Right: send */}
                            <motion.button
                                type="button"
                                onClick={handleSendMessage}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                disabled={isTyping || !value.trim()}
                                className={cn(
                                    "p-2 rounded-xl transition-all duration-200 shrink-0 cursor-pointer",
                                    value.trim()
                                        ? "bg-white text-black shadow-lg shadow-white/10"
                                        : "bg-white/[0.06] text-white/20"
                                )}
                                aria-label="Send message"
                            >
                                {isTyping ? (
                                    <LemniscateLoader size="sm" className="text-current" />
                                ) : (
                                    <SendIcon className="w-4 h-4" />
                                )}
                            </motion.button>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Typing indicator */}
            <AnimatePresence>
                {isTyping && (
                    <motion.div 
                        className="fixed bottom-24 left-[var(--sidebar-width)] right-0 z-40 flex justify-center pointer-events-none"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                    >
                        <div className="backdrop-blur-xl bg-white/[0.03] rounded-full px-4 py-1.5 border border-white/[0.05] flex items-center gap-2">
                            <span className="text-[11px] text-white/50 font-medium">Relay AI is thinking</span>
                            <TypingDots />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirmation Fallback Modal */}
            <AnimatePresence>
                {showFallbackModal && (
                    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-[999] p-4">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-zinc-950 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4"
                        >
                            <div className="flex gap-3 items-start">
                                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <h3 className="text-base font-bold text-white">AI Provider Failure</h3>
                                    <p className="text-xs text-zinc-400 leading-relaxed font-body">
                                        {fallbackMessage}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex gap-3 justify-end mt-2">
                                <button
                                    onClick={() => setShowFallbackModal(false)}
                                    className="px-4 py-2 border border-white/10 hover:bg-white/5 text-xs font-medium text-white rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmFallback}
                                    className="px-4 py-2 bg-white hover:bg-zinc-200 text-xs font-medium text-black rounded-lg transition"
                                >
                                    Switch to Relay Cloud
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function TypingDots() {
    return (
        <div className="flex items-center ml-1">
            {[1, 2, 3].map((dot) => (
                <motion.div
                    key={dot}
                    className="w-1.5 h-1.5 bg-white/90 rounded-full mx-0.5"
                    initial={{ opacity: 0.3 }}
                    animate={{ 
                        opacity: [0.3, 0.9, 0.3],
                        scale: [0.85, 1.1, 0.85]
                    }}
                    transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: dot * 0.15,
                        ease: "easeInOut",
                    }}
                    style={{
                        boxShadow: "0 0 4px rgba(255, 255, 255, 0.3)"
                    }}
                />
            ))}
        </div>
    );
}
