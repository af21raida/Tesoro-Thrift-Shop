import type { Config } from "tailwindcss";

// Design language: a light, warm antique/secondhand-market theme. Ivory
// parchment backgrounds, dark-walnut ink for text, muted olive for
// "good/success", antique gold (brass) for "waiting", muted plum for a
// live auction, and dusty burgundy (stamp) for closed/rejected — like
// ink stamps on a thrift tag. The header uses deep burgundy (#2F0909)
// with deep teal (#092E2E) as the primary accent and restrained antique
// gold (brass) for premium/vintage details. See app/globals.css for the
// type stack.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F6F1E4",
        "paper-dim": "#ECE4D0",
        ink: "#3A2E20",
        "ink-soft": "#6E6150",
        market: {
          DEFAULT: "#6C7A45",
          dark: "#55613A",
          light: "#87975C",
        },
        brass: {
          DEFAULT: "#A9813C",
          light: "#CDA96A",
          dark: "#7C5C26",
        },
        plum: "#7A4A5A",
        stamp: "#8A3B34",
        line: "#D5CBB2",
        burgundy: {
          DEFAULT: "#2F0909",
          dark: "#230707",
        },
        teal: {
          DEFAULT: "#092E2E",
          dark: "#062020",
          light: "#0F3D3D",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        body: ["var(--font-body)", "ui-serif", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-serif", "Georgia", "serif"],
      },
      borderRadius: {
        tag: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
