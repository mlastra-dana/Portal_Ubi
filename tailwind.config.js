/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0B5ED7',
        primaryDark: '#0849A9',
        bgSoft: '#F5F7FB',
        textMain: '#111827',
        borderSoft: '#E5E7EB'
      },
      boxShadow: {
        soft: '0 10px 30px rgba(17,24,39,0.07)'
      },
      maxWidth: {
        content: '1120px'
      }
    }
  },
  plugins: []
};
