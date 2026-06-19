"use client";

import { useEffect, useRef, useCallback, useTransition } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
    Paperclip,
    SendIcon,
    XIcon,
    LoaderIcon,
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
} from "lucide-react";
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

export default function BriefingPage() {
    const router = useRouter();
    const [value, setValue] = useState("");
    const [attachments, setAttachments] = useState<string[]>([]);
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

    const [messages, setMessages] = useState<Array<{ sender: "user" | "ai"; text: string; actionUrl?: string; isError?: boolean }>>([]);



    const commandSuggestions: CommandSuggestion[] = [
        { 
            icon: <Sparkles className="w-4 h-4" />, 
            label: "Briefing", 
            description: "Show strategic dashboard & briefing", 
            prefix: "/briefing" 
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

        // Reset input area immediately like standard chat interfaces
        setValue("");
        adjustHeight(true);
        setIsTyping(true);

        // Append user query to conversation history
        setMessages(prev => [...prev, { sender: "user", text: queryText }]);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    message: queryText, 
                    conversationId: null,
                    provider: selectedProvider,
                    model: selectedModel
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
        const mockFileName = `file-${Math.floor(Math.random() * 1000)}.pdf`;
        setAttachments(prev => [...prev, mockFileName]);
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

    return (
        <div className="min-h-[calc(100vh-140px)] flex flex-col w-full items-center justify-center bg-transparent text-white p-6 relative overflow-hidden">
            <div className="absolute inset-0 w-full h-full overflow-hidden">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/[0.03] rounded-full mix-blend-normal filter blur-[128px] animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-zinc-300/[0.02] rounded-full mix-blend-normal filter blur-[128px] animate-pulse delay-700" />
                <div className="absolute top-1/4 right-1/3 w-64 h-64 bg-zinc-100/[0.015] rounded-full mix-blend-normal filter blur-[96px] animate-pulse delay-1000" />
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
                                How can I help today?
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
                            Type a command or ask a question
                        </motion.p>
                    </div>

                    {/* Chat Messages Thread */}
                    {messages.length > 0 && (
                        <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 flex flex-col gap-3 scroll-smooth select-text w-full z-10">
                            <AnimatePresence initial={false}>
                                {messages.map((msg, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ duration: 0.25, ease: "easeOut" }}
                                        className={cn(
                                            "flex w-full gap-3 items-start",
                                            msg.sender === "user" ? "justify-end" : "justify-start"
                                        )}
                                    >
                                        {msg.sender === "ai" && (
                                            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-mono font-bold text-white shrink-0 mt-0.5 shadow-md">
                                                zap
                                            </div>
                                        )}

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
                                                <div className="whitespace-pre-wrap">{msg.text}</div>
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

                                        {msg.sender === "user" && (
                                            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10px] font-mono font-bold text-white shrink-0 mt-0.5 shadow-md">
                                                US
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}


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
                                placeholder="Ask zap a question..."
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
                                            <span>{file}</span>
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
                                    <LoaderIcon className="w-4 h-4 animate-[spin_2s_linear_infinite]" />
                                ) : (
                                    <SendIcon className="w-4 h-4" />
                                )}
                                <span>Send</span>
                            </motion.button>
                        </div>
                    </motion.div>
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
                            <div className="w-8 h-7 rounded-full bg-white/[0.05] flex items-center justify-center text-center">
                                <span className="text-xs font-medium text-white/90 mb-0.5">zap</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-white/70">
                                <span>Thinking</span>
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
