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
        primary: '#379FD9',
        primaryDark: '#2B8FC6',
        bgSoft: '#EDF3F7',
        surfaceMuted: '#E6EEF3',
        textMain: '#1F2D3A',
        borderSoft: '#D3DEE8'
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
