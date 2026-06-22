import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{astro,html,ts}",
    "./public/**/*.html",
    "./settings.yaml",
  ],
  darkMode: "class",
  plugins: [typography],
};
