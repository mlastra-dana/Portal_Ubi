/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito Sans', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Poppins', 'Nunito Sans', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif']
      },
      colors: {
        ubii: {
          blue: '#4B98CB',
          hover: '#3E86B6',
          light: '#F5F9FD',
          black: '#111111',
          border: '#E5E7EB',
          panel: '#FFFFFF'
        }
      },
      boxShadow: {
        soft: '0 8px 24px rgba(16, 24, 40, 0.08)'
      },
      maxWidth: {
        content: '72rem'
      }
    }
  },
  plugins: []
};
