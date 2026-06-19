import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)", // Monochrome White
          hover: "#e4e4e7",          // Monochrome Hover
        },
        cta: {
          DEFAULT: "var(--primary)", // Monochrome White
          hover: "#e4e4e7",          // Monochrome Hover
        },
        bg: {
          light: "#F7F7F4",   // Cursor Cream
          dark: "#000000",    // Pure Black
        },
        cursor: {
          thinking: "#dfa88f",
          grep: "#9fc9a2",
          read: "#9fbbe0",
          edit: "#c0a8dd",
          done: "#c08532",
        },
        navy: {
          DEFAULT: "#807d72", // Cursor Muted
          light: "#a09c92",   // Cursor Muted Soft
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "Space Grotesk", "sans-serif"],
        body: ["var(--font-body)", "DM Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
