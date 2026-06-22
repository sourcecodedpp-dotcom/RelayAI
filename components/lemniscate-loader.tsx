"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

const SVG_NS = "http://www.w3.org/2000/svg";

interface LemniscateLoaderProps {
  /** sm = 32px, md = 64px, lg = 120px */
  size?: "sm" | "md" | "lg";
  /** Optional label shown below the animation */
  label?: string;
  /** Additional class names for the wrapper */
  className?: string;
}

const SIZE_MAP = {
  sm: { wrapper: "w-8 h-8", particles: 30, stroke: 5.5, labelClass: "text-[9px] mt-1.5" },
  md: { wrapper: "w-16 h-16", particles: 50, stroke: 5, labelClass: "text-[10px] mt-2" },
  lg: { wrapper: "w-28 h-28", particles: 70, stroke: 4.8, labelClass: "text-xs mt-3" },
};

const CONFIG = {
  trailSpan: 0.4,
  durationMs: 5600,
  pulseDurationMs: 5000,
  lemniscateA: 20,
  lemniscateBoost: 7,
};

function lemniscatePoint(progress: number, detailScale: number) {
  const t = progress * Math.PI * 2;
  const scale = CONFIG.lemniscateA + detailScale * CONFIG.lemniscateBoost;
  const denom = 1 + Math.sin(t) ** 2;
  return {
    x: 50 + (scale * Math.cos(t)) / denom,
    y: 50 + (scale * Math.sin(t) * Math.cos(t)) / denom,
  };
}

function normalizeProgress(p: number) {
  return ((p % 1) + 1) % 1;
}

function getDetailScale(time: number) {
  const pulseProgress = (time % CONFIG.pulseDurationMs) / CONFIG.pulseDurationMs;
  const pulseAngle = pulseProgress * Math.PI * 2;
  return 0.52 + ((Math.sin(pulseAngle + 0.55) + 1) / 2) * 0.48;
}

function buildPath(detailScale: number, steps = 480) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const pt = lemniscatePoint(i / steps, detailScale);
    return `${i === 0 ? "M" : "L"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
  }).join(" ");
}

export function LemniscateLoader({ size = "md", label, className }: LemniscateLoaderProps) {
  const groupRef = useRef<SVGGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const particlesRef = useRef<SVGCircleElement[]>([]);
  const frameRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);

  const sizeConfig = SIZE_MAP[size];
  const particleCount = sizeConfig.particles;

  const initParticles = useCallback(
    (group: SVGGElement) => {
      // Clear existing particles
      const existing = group.querySelectorAll("circle");
      existing.forEach((c) => c.remove());

      particlesRef.current = Array.from({ length: particleCount }, () => {
        const circle = document.createElementNS(SVG_NS, "circle");
        circle.setAttribute("fill", "currentColor");
        group.appendChild(circle);
        return circle;
      });
    },
    [particleCount]
  );

  useEffect(() => {
    const group = groupRef.current;
    const path = pathRef.current;
    if (!group || !path) return;

    initParticles(group);
    startedAtRef.current = performance.now();

    function render(now: number) {
      const time = now - startedAtRef.current;
      const progress = (time % CONFIG.durationMs) / CONFIG.durationMs;
      const detailScale = getDetailScale(time);

      path!.setAttribute("d", buildPath(detailScale));

      particlesRef.current.forEach((node, index) => {
        const tailOffset = index / (particleCount - 1);
        const pt = lemniscatePoint(
          normalizeProgress(progress - tailOffset * CONFIG.trailSpan),
          detailScale
        );
        const fade = Math.pow(1 - tailOffset, 0.56);

        node.setAttribute("cx", pt.x.toFixed(2));
        node.setAttribute("cy", pt.y.toFixed(2));
        node.setAttribute("r", (0.9 + fade * 2.7).toFixed(2));
        node.setAttribute("opacity", (0.04 + fade * 0.96).toFixed(3));
      });

      frameRef.current = requestAnimationFrame(render);
    }

    frameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameRef.current);
    };
  }, [particleCount, initParticles]);

  return (
    <div className={cn("flex flex-col items-center justify-center select-none", className)}>
      <div className={cn(sizeConfig.wrapper, "flex items-center justify-center")}>
        <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" className="w-full h-full overflow-visible">
          <g ref={groupRef}>
            <path
              ref={pathRef}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={sizeConfig.stroke}
              opacity="0.1"
            />
          </g>
        </svg>
      </div>
      {label && (
        <span
          className={cn(
            "font-mono tracking-widest uppercase text-current opacity-40 animate-pulse",
            sizeConfig.labelClass
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export default LemniscateLoader;
