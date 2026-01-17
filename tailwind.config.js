/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./*.html",
        "./*.js",
        "./CSS/**/*.css"
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                primary: "#0ea5e9", // Vibrant Sky Blue
                "primary-hover": "#0284c7",
                "primary-light": "#e0f2fe",
                "accent-mint": "#10b981", // Vibrant Mint/Emerald
                "accent-mint-light": "#ecfdf5",
                "accent-yellow": "#f59e0b", // Sunny Yellow/Amber
                "accent-yellow-light": "#fffbeb",
                "slate-850": "#1e293b",
                // Dark mode colors
                "dark-bg": "#0f172a", // slate-900
                "dark-surface": "#1e293b", // slate-800
                "dark-text": "#f1f5f9", // slate-100
                "dark-text-secondary": "#cbd5e1", // slate-300
                "dark-border": "#334155", // slate-700
            },
            fontFamily: {
                display: ["Manrope", "sans-serif"],
                body: ["Noto Sans", "sans-serif"],
            },
            borderRadius: {
                DEFAULT: "0.5rem",
                lg: "0.75rem",
                xl: "1rem",
                "2xl": "1.5rem",
                "3xl": "2rem",
                full: "9999px",
            },
            boxShadow: {
                soft: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
                hover: "0 20px 40px -5px rgba(14, 165, 233, 0.1)",
            },
            animation: {
                marquee: "marquee 30s linear infinite",
                fadeIn: "fadeIn 0.5s ease-in-out",
                slideIn: "slideIn 0.3s ease-out",
            },
            keyframes: {
                marquee: {
                    '0%': { transform: 'translateX(0)' },
                    '100%': { transform: 'translateX(-50%)' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideIn: {
                    '0%': { transform: 'translateY(-10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
            },
        },
    },
    plugins: [],
}
