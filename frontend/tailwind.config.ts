import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef2ff",
          500: "#4f46e5",
          600: "#4338ca"
        }
      }
    }
  },
  plugins: []
};

export default config;
