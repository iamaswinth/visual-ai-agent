import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1280px" } },
    extend: {
      fontFamily: {
        // Inter is the design's named Haas substitute; falls through to system-ui / Segoe UI.
        sans: [
          "var(--font-inter)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        // Airtable signature palette (exact hex, no alpha modifiers needed).
        ink: "#181d26",
        body: "#333840",
        hairline: "#dddddd",
        canvas: "#ffffff",
        "surface-soft": "#f8fafc",
        "surface-strong": "#e0e2e6",
        link: "#1b61c9",
        coral: "#aa2d00",
        forest: "#0a2e0e",
        cream: "#f5e9d4",
        peach: "#fcab79",
        mint: "#a8d8c4",
        yellow: "#f4d35e",
        mustard: "#d9a441",
      },
      borderRadius: {
        // Airtable radius scale: lg 12 (CTA/signature), md 10 (cards), sm 6 (inputs).
        lg: "12px",
        md: "10px",
        sm: "6px",
        xl: "12px",
      },
      maxWidth: { content: "1280px" },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: { "accordion-down": "accordion-down 0.2s ease-out", "accordion-up": "accordion-up 0.2s ease-out" },
    },
  },
  plugins: [tailwindcssAnimate],
};
