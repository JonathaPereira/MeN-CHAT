import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: { colors: { ink: "#15372f", pine: "#156c53", canvas: "#f7f9f6" } },
  },
  plugins: [],
} satisfies Config;
