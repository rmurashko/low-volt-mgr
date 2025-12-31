/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0f172a',
          dark: '#020617',
          silver: '#f1f5f9',
          border: '#cbd5e1',
          electric: '#0ea5e9',
        }
      },
      backgroundImage: {
        'tech-grid': "radial-gradient(#cbd5e1 1px, transparent 1px)",
      },
      boxShadow: {
        'glow': '0 0 10px rgba(14, 165, 233, 0.5)',
      }
    },
  },
  plugins: [],
}