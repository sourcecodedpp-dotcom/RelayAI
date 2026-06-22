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
    AlertTriangle,
    ChevronDown,
    ChevronRight,
    Brain,
} from "lucide-react";
import { LemniscateLoader } from "@/components/lemniscate-loader";
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";
import { useRouter } from "next/navigation";
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

export default function DashboardHomePage() {
    const router = useRouter();
    const [value, setValue] = useState("");
    const [attachments, setAttachments] = useState<Array<{ name: string; size: number; type: string; content: string }>>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [recentCommand, setRecentCommand] = useState<string | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 60,
        maxHeight: 200,
    });
    const [inputFocused, setInputFocused] = useState(false);
    const commandPaletteRef = useRef<HTMLDivElement>(null);

    // Providers states
    const [selectedProvider, setSelectedProvider] = useState("system");
    const [selectedModel, setSelectedModel] = useState("mercury-2");
    const [providersData, setProvidersData] = useState<any>(null);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [showFallbackModal, setShowFallbackModal] = useState(false);
    const [fallbackMessage, setFallbackMessage] = useState("");

    // Load provider choices and default user setting
    useEffect(() => {
        const fetchProviders = async () => {
            try {
                const res = await fetch("/api/providers");
                if (res.ok) {
                    const pData = await res.json();
                    setProvidersData(pData);
                    if (pData.defaultProvider) {
                        setSelectedProvider(pData.defaultProvider);
                    }
                    if (pData.defaultModel) {
                        setSelectedModel(pData.defaultModel);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch providers:", err);
            }
        };
        fetchProviders();
    }, []);

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

        // Append user query to conversation history
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
                    conversationId: null,
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
                throw new Error(data.error || "Failed to process command.");
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

                // Redirect to the newly created conversation page
                setTimeout(() => {
                    router.push(`/c/${data.conversationId}`);
                }, 1000);
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
                        conversationId: null,
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
                    setTimeout(() => {
                        router.push(`/c/${data.conversationId}`);
                    }, 1000);
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
        <div className="min-h-[calc(100vh-140px)] flex flex-col w-full items-center justify-center bg-transparent text-white p-6 relative overflow-hidden">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
            />
            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none">
                {/* Premium, low-contrast dot grid */}
                <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:24px_24px]" />
                
                {/* Vignette mask to fade grid at borders */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,#000000_90%)]" />

                {/* Soft slowly-drifting ambient glow: Indigo top-left */}
                <motion.div 
                    className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-indigo-500/[0.035] blur-[130px] mix-blend-screen"
                    animate={{
                        x: [0, 40, -20, 0],
                        y: [0, -30, 20, 0],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />

                {/* Soft slowly-drifting ambient glow: Slate-blue center */}
                <motion.div 
                    className="absolute top-[25%] left-[20%] w-[50%] h-[50%] rounded-full bg-blue-500/[0.015] blur-[120px] mix-blend-screen"
                    animate={{
                        x: [0, -30, 30, 0],
                        y: [0, 40, -40, 0],
                    }}
                    transition={{
                        duration: 25,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />

                {/* Soft slowly-drifting ambient glow: Warm bronze/amber bottom-right */}
                <motion.div 
                    className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full bg-amber-500/[0.025] blur-[140px] mix-blend-screen"
                    animate={{
                        x: [0, -40, 20, 0],
                        y: [0, 30, -20, 0],
                    }}
                    transition={{
                        duration: 22,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />

                {/* Mouse-following reactive highlight */}
                <div 
                    className="absolute inset-0 transition-opacity duration-500 ease-out" 
                    style={{ 
                        background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(99, 102, 241, 0.03), rgba(6, 182, 212, 0.01) 40%, transparent 80%)` 
                    }} 
                />
            </div>
            <div className="w-full max-w-2xl mx-auto relative">
                <motion.div 
                    className="relative z-10 space-y-12"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <div className="text-center space-y-3">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                            className="inline-block"
                        >
                            <h1 className="text-3xl font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white/90 to-white/40 pb-1">
                                Who are we reaching out to today?
                            </h1>
                            <motion.div 
                                className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: "100%", opacity: 1 }}
                                transition={{ delay: 0.5, duration: 0.8 }}
                            />
                        </motion.div>
                        <motion.p 
                            className="text-sm text-white/40"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            Draft a new sequence, search verified leads, or automate follow-ups
                        </motion.p>
                    </div>

                    {/* Chat Messages Thread */}
                    {messages.length > 0 && (
                        <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 flex flex-col gap-3 scroll-smooth select-text w-full z-10">
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
                                            initial={{ opacity: 0, y: 12, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            transition={{ duration: 0.25, ease: "easeOut" }}
                                            className={cn(
                                                "flex w-full gap-3 items-start",
                                                msg.sender === "user" ? "justify-end" : "justify-start"
                                            )}
                                        >


                                            <div
                                                className={cn(
                                                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed border shadow-lg relative overflow-hidden",
                                                    msg.sender === "user"
                                                        ? "bg-white/[0.08] border-white/10 text-white rounded-tr-none font-body"
                                                        : msg.isError
                                                            ? "bg-red-950/20 border-red-500/20 text-red-200 rounded-tl-none font-body"
                                                            : "bg-zinc-900/60 border-white/5 text-zinc-100 rounded-tl-none font-body"
                                                )}
                                            >
                                                {msg.sender === "ai" && !msg.isError && (
                                                    <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest font-bold mb-1 select-none">
                                                        AI Response
                                                    </div>
                                                )}
                                                {msg.sender === "ai" && msg.isError && (
                                                    <div className="text-[10px] font-mono text-red-400 uppercase tracking-widest font-bold mb-1 select-none">
                                                        Execution Error
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
                                                    <div className="mt-3 pt-2.5 border-t border-white/5 flex justify-end select-none">
                                                        <Link
                                                            href={msg.actionUrl}
                                                            className="text-xs font-bold text-white hover:text-zinc-300 hover:underline flex items-center gap-1 transition"
                                                        >
                                                            Navigate to Page &rarr;
                                                        </Link>
                                                    </div>
                                                )}
                                            </div>


                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    )}


                    {messages.length > 0 ? (
                        <motion.div 
                            className="relative backdrop-blur-2xl bg-white/[0.03] rounded-xl border border-white/10 shadow-lg flex items-end gap-2 p-2 pl-4"
                            initial={{ scale: 0.98 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.1 }}
                        >
                            <AnimatePresence>
                                {showCommandPalette && (
                                    <motion.div 
                                        ref={commandPaletteRef}
                                        className="absolute left-0 right-0 bottom-full mb-2 backdrop-blur-xl bg-black/95 rounded-lg z-50 shadow-lg border border-white/10 overflow-hidden"
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
                                                        "flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer",
                                                        activeSuggestion === index 
                                                            ? "bg-white/10 text-white" 
                                                            : "text-white/70 hover:bg-white/5"
                                                    )}
                                                    onClick={() => selectCommandSuggestion(index)}
                                                >
                                                    <div className="w-4 h-4 flex items-center justify-center text-white/60">
                                                        {suggestion.icon}
                                                    </div>
                                                    <div className="font-medium text-[11px]">{suggestion.label}</div>
                                                    <div className="text-white/40 text-[10px] ml-auto font-mono">
                                                        {suggestion.prefix}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <AnimatePresence>
                                {attachments.length > 0 && (
                                    <motion.div 
                                        className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-zinc-950/90 border border-white/10 rounded-xl flex gap-2 flex-wrap z-40"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                    >
                                        {attachments.map((file, index) => (
                                            <motion.div
                                                key={index}
                                                className="flex items-center gap-2 text-xs bg-white/[0.03] py-1.5 px-3 rounded-lg text-white/70"
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                            >
                                                <span>{file.name}</span>
                                                <span className="text-[10px] text-white/30">({Math.round(file.size / 1024)} KB)</span>
                                                <button 
                                                    onClick={() => removeAttachment(index)}
                                                    className="text-white/40 hover:text-white transition-colors"
                                                >
                                                    <XIcon className="w-3 h-3" />
                                                </button>
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="flex-grow flex items-center">
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
                                    placeholder="Ask Relay AI..."
                                    containerClassName="w-full"
                                    className={cn(
                                        "w-full py-2 px-0",
                                        "resize-none",
                                        "bg-transparent",
                                        "border-none",
                                        "text-white/90 text-sm",
                                        "focus:outline-none focus:ring-0 focus-visible:ring-0",
                                        "placeholder:text-white/20",
                                        "min-h-[36px] max-h-[160px]"
                                    )}
                                    style={{
                                        overflow: "hidden",
                                        boxShadow: "none"
                                    }}
                                    showRing={false}
                                />
                            </div>

                            <motion.button
                                type="button"
                                onClick={handleSendMessage}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                disabled={isTyping || !value.trim()}
                                className={cn(
                                    "p-2 rounded-lg transition-all shrink-0 mb-0.5",
                                    value.trim()
                                        ? "bg-white text-black"
                                        : "bg-white/5 text-white/30"
                                )}
                            >
                                {isTyping ? (
                                    <LemniscateLoader size="sm" className="text-current" />
                                ) : (
                                    <SendIcon className="w-4 h-4" />
                                )}
                            </motion.button>
                        </motion.div>
                    ) : (
                        <motion.div 
                            className="relative backdrop-blur-2xl bg-white/[0.02] rounded-2xl border border-white/[0.05] shadow-2xl"
                            initial={{ scale: 0.98 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.1 }}
                        >
                            <AnimatePresence>
                                {showCommandPalette && (
                                    <motion.div 
                                        ref={commandPaletteRef}
                                        className="absolute left-4 right-4 bottom-full mb-2 backdrop-blur-xl bg-black/90 rounded-lg z-50 shadow-lg border border-white/10 overflow-hidden"
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 5 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        <div className="py-1 bg-black/95">
                                            {commandSuggestions.map((suggestion, index) => (
                                                <motion.div
                                                    key={suggestion.prefix}
                                                    className={cn(
                                                        "flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer",
                                                        activeSuggestion === index 
                                                            ? "bg-white/10 text-white" 
                                                            : "text-white/70 hover:bg-white/5"
                                                    )}
                                                    onClick={() => selectCommandSuggestion(index)}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: index * 0.03 }}
                                                >
                                                    <div className="w-5 h-5 flex items-center justify-center text-white/60">
                                                        {suggestion.icon}
                                                    </div>
                                                    <div className="font-medium">{suggestion.label}</div>
                                                    <div className="text-white/40 text-xs ml-1">
                                                        {suggestion.prefix}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="p-4">
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
                                    placeholder="Ask Relay AI to draft a campaign, find prospects, or check analytics..."
                                    containerClassName="w-full"
                                    className={cn(
                                        "w-full px-4 py-3",
                                        "resize-none",
                                        "bg-transparent",
                                        "border-none",
                                        "text-white/90 text-sm",
                                        "focus:outline-none",
                                        "placeholder:text-white/20",
                                        "min-h-[60px]"
                                    )}
                                    style={{
                                        overflow: "hidden",
                                    }}
                                    showRing={false}
                                />
                            </div>

                            <AnimatePresence>
                                {attachments.length > 0 && (
                                    <motion.div 
                                        className="px-4 pb-3 flex gap-2 flex-wrap"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                    >
                                        {attachments.map((file, index) => (
                                            <motion.div
                                                key={index}
                                                className="flex items-center gap-2 text-xs bg-white/[0.03] py-1.5 px-3 rounded-lg text-white/70"
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                            >
                                                <span>{file.name}</span>
                                                <span className="text-[10px] text-white/30">({Math.round(file.size / 1024)} KB)</span>
                                                <button 
                                                    onClick={() => removeAttachment(index)}
                                                    className="text-white/40 hover:text-white transition-colors"
                                                >
                                                    <XIcon className="w-3 h-3" />
                                                </button>
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="p-4 border-t border-white/[0.05] flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <motion.button
                                        type="button"
                                        onClick={handleAttachFile}
                                        whileTap={{ scale: 0.94 }}
                                        className="p-2 text-white/40 hover:text-white/90 rounded-lg transition-colors relative group"
                                    >
                                        <Paperclip className="w-4 h-4" />
                                        <motion.span
                                            className="absolute inset-0 bg-white/[0.05] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                            layoutId="button-highlight"
                                        />
                                    </motion.button>
                                    <motion.button
                                        type="button"
                                        data-command-button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowCommandPalette(prev => !prev);
                                        }}
                                        whileTap={{ scale: 0.94 }}
                                        className={cn(
                                            "p-2 text-white/40 hover:text-white/90 rounded-lg transition-colors relative group",
                                            showCommandPalette && "bg-white/10 text-white/90"
                                        )}
                                    >
                                        <Command className="w-4 h-4" />
                                        <motion.span
                                            className="absolute inset-0 bg-white/[0.05] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                            layoutId="button-highlight"
                                        />
                                    </motion.button>

                                    {/* Model Selector Dropdown */}
                                    <div className="relative">
                                        <motion.button
                                            type="button"
                                            onClick={() => setShowModelDropdown(prev => !prev)}
                                            whileTap={{ scale: 0.94 }}
                                            className={cn(
                                                "px-2.5 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-[11px] text-white/70 font-mono transition-colors flex items-center gap-1.5",
                                                showModelDropdown && "bg-white/10 text-white"
                                            )}
                                        >
                                            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                                            <span className="max-w-[100px] truncate">{selectedModel === "mercury-2" ? "Relay Cloud" : selectedModel}</span>
                                            <span className="text-[8px] text-white/30">▼</span>
                                        </motion.button>
                                        
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
                                
                                <motion.button
                                    type="button"
                                    onClick={handleSendMessage}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.98 }}
                                    disabled={isTyping || !value.trim()}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                        "flex items-center gap-2",
                                        value.trim()
                                            ? "bg-white text-[#0A0A0B] shadow-lg shadow-white/10"
                                            : "bg-white/[0.05] text-white/40"
                                    )}
                                >
                                    {isTyping ? (
                                        <LemniscateLoader size="sm" className="text-current" />
                                    ) : (
                                        <SendIcon className="w-4 h-4" />
                                    )}
                                    <span>Send</span>
                                </motion.button>
                            </div>
                        </motion.div>
                    )}
                </motion.div>
            </div>

            <AnimatePresence>
                {isTyping && (
                    <motion.div 
                        className="fixed bottom-8 mx-auto transform -translate-x-1/2 backdrop-blur-2xl bg-white/[0.02] rounded-full px-4 py-2 shadow-lg border border-white/[0.05]"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-7 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-center shadow-md">
                                <Sparkles className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div className="flex items-center gap-2 text-sm text-white/70">
                                <span>Relay AI is thinking</span>
                                <TypingDots />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {inputFocused && (
                <motion.div 
                    className="fixed w-[50rem] h-[50rem] rounded-full pointer-events-none z-0 opacity-[0.02] bg-gradient-to-r from-white via-zinc-200 to-zinc-400 blur-[96px]"
                    animate={{
                        x: mousePosition.x - 400,
                        y: mousePosition.y - 400,
                    }}
                    transition={{
                        type: "spring",
                        damping: 25,
                        stiffness: 150,
                        mass: 0.5,
                    }}
                />
            )}

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
