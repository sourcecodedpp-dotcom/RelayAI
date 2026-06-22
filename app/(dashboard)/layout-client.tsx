"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import { Menu } from "lucide-react";

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const cached = localStorage.getItem("sidebar-collapsed");
      if (cached) {
        setCollapsed(cached === "true");
      }
    } catch (e) {
      console.error("Failed to load sidebar collapsed state", e);
    }
  }, []);

  const toggleCollapse = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    try {
      localStorage.setItem("sidebar-collapsed", String(newState));
    } catch (e) {
      console.error("Failed to save sidebar collapsed state", e);
    }
  };

  return (
    <div 
      className="flex h-screen bg-bg-dark text-gray-200 overflow-hidden w-full relative"
      style={{ "--sidebar-width": collapsed ? "0px" : "256px" } as React.CSSProperties}
    >
      {/* Sidebar with collapse control state */}
      <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />

      {/* Floating expand button when sidebar is collapsed */}
      {collapsed && (
        <button
          onClick={toggleCollapse}
          className="absolute top-4 left-4 z-50 w-8 h-8 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white backdrop-blur-md cursor-pointer transition shadow-md hover:scale-105 active:scale-95"
          title="Expand Sidebar"
        >
          <Menu size={16} />
        </button>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <main className="flex-1 overflow-y-auto relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
