import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#05060a",
          900: "#080a12",
          850: "#0b0e18",
          800: "#10131f",
          700: "#171b2b",
          600: "#20263a",
        },
        accent: {
          blue: "#5b8cff",
          sky: "#7cc4ff",
          violet: "#9b7bff",
          indigo: "#6d72ff",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Inter",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
        mono: ["SF Mono", "JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: {
        "4xl": "28px",
      },
      boxShadow: {
        glass:
          "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.4), 0 20px 50px -20px rgba(0,0,0,0.8)",
        glow: "0 0 0 1px rgba(124,140,255,0.28), 0 8px 30px -8px rgba(110,120,255,0.55)",
        lift: "inset 0 1px 0 0 rgba(255,255,255,0.08), 0 30px 60px -24px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)",
      },
      transitionTimingFunction: {
        ios: "cubic-bezier(0.32, 0.72, 0, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        pulseglow: {
          "0%,100%": { opacity: "0.45" },
          "50%": { opacity: "1" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(10px) scale(0.995)" },
          to: { opacity: "1", transform: "none" },
        },
        fadein: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        pop: {
          from: { opacity: "0", transform: "translateY(-6px) scale(0.98)" },
          to: { opacity: "1", transform: "none" },
        },
        drift: {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(3%,4%,0) scale(1.08)" },
        },
        spin: {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        pulseglow: "pulseglow 2.2s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
        rise: "rise 0.6s cubic-bezier(0.32, 0.72, 0, 1) both",
        fadein: "fadein 0.4s ease both",
        pop: "pop 0.32s cubic-bezier(0.32, 0.72, 0, 1) both",
        drift: "drift 22s ease-in-out infinite",
        "drift-slow": "drift 34s ease-in-out infinite reverse",
      },
    },
  },
  plugins: [],
};

export default config;
