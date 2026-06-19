import { RelationshipStatus } from './types';

export const UTILS = {
  /**
   * Linear interpolation between two values
   */
  lerp: (start: number, end: number, amt: number): number => (1 - amt) * start + amt * end,

  /**
   * Distance between two 2D points
   */
  distance: (x1: number, y1: number, x2: number, y2: number): number => 
    Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),

  /**
   * Check if point (px, py) is inside a circle at (cx, cy) with radius r
   */
  pointInCircle: (px: number, py: number, cx: number, cy: number, r: number): boolean => {
    return UTILS.distance(px, py, cx, cy) <= r;
  },

  /**
   * Get contrasting text color based on hex background
   */
  getContrastColor: (hex: string): string => {
    if (!hex || hex.startsWith('rgba')) return '#e4e4e7';
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#09090b' : '#ffffff';
  },

  /**
   * Format numbers to currency/percentage helper
   */
  formatPercent: (val: number): string => `${val}%`,

  /**
   * Fuzzy string matching for search
   */
  fuzzyMatch: (text: string, query: string): boolean => {
    if (!text || !query) return false;
    const cleanText = text.toLowerCase();
    const cleanQuery = query.toLowerCase();
    return cleanText.includes(cleanQuery);
  },

  /**
   * Get status hex color (Grayscale/Monochrome theme)
   */
  getStatusColor: (status: RelationshipStatus): string => {
    const colors: Record<RelationshipStatus, string> = {
      undiscovered: '#52525b', // zinc 600
      researched: '#71717a',   // zinc 500
      outreach: '#a1a1aa',     // zinc 400
      active: '#e4e4e7',       // zinc 200
      scheduled: '#ffffff',    // white
      stale: '#27272a'         // zinc 800
    };
    return colors[status] || colors.undiscovered;
  },

  /**
   * Get status glow color (rgba with low opacity)
   */
  getStatusGlow: (status: RelationshipStatus): string => {
    const glows: Record<RelationshipStatus, string> = {
      undiscovered: 'rgba(82, 82, 91, 0.15)',
      researched: 'rgba(113, 113, 122, 0.15)',
      outreach: 'rgba(161, 161, 170, 0.2)',
      active: 'rgba(228, 228, 231, 0.25)',
      scheduled: 'rgba(255, 255, 255, 0.3)',
      stale: 'rgba(39, 39, 42, 0.1)'
    };
    return glows[status] || glows.undiscovered;
  },

  /**
   * Easing curves
   */
  easeOutCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
  
  easeInCubic: (t: number): number => t * t * t,

  easeInOutQuad: (t: number): number => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
};
