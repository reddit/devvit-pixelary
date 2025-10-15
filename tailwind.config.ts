import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    // Pixel text scale classes
    'text-pixel-text-scale-1',
    'text-pixel-text-scale-1-2',
    'text-pixel-text-scale-1-5',
    'text-pixel-text-scale-2',
    'text-pixel-text-scale-2-5',
    'text-pixel-text-scale-3',
    'text-pixel-text-scale-4',
    'text-pixel-text-scale-5',
    'text-pixel-text-scale-6',
    'text-pixel-text-scale-8',
    'text-pixel-text-scale-10',
    // Font classes
    'font-pixel',
    'font-mono',
  ],
  theme: {
    extend: {
      // Colors
      colors: {
        pixel: {
          white: '#FFFFFF',
          black: '#000000',
          red: '#EB5757',
          orange: '#F2994A',
          yellow: '#F2C94C',
          green: '#27AE60',
          blue: '#2F80ED',
          purple: '#9B51E0',
        },
        brand: {
          primary: '#000000',
          secondary: '#07495F',
          tertiary: '#0E92BE',
          weak: '#B2B2B2',
          background: '#56CCF2',
          orangered: '#FF4500',
        },
        semantic: {
          success: '#27AE60',
          error: '#EB5757',
          warning: '#F2C94C',
          info: '#2F80ED',
        },
        neutral: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        shadow: {
          light: 'rgba(0, 0, 0, 0.1)',
          medium: 'rgba(0, 0, 0, 0.2)',
          strong: 'rgba(0, 0, 0, 0.3)',
          heavy: 'rgba(0, 0, 0, 0.4)',
        },
      },
      // Spacing (4px increments for pixel-perfect design)
      spacing: {
        0: '0px',
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        7: '28px',
        8: '32px',
        9: '36px',
        10: '40px',
        11: '44px',
        12: '48px',
        14: '56px',
        16: '64px',
        20: '80px',
        24: '96px',
        28: '112px',
        32: '128px',
        36: '144px',
        40: '160px',
        44: '176px',
        48: '192px',
        52: '208px',
        56: '224px',
        60: '240px',
        64: '256px',
        72: '288px',
        80: '320px',
        96: '384px',
      },
      // Font sizes
      fontSize: {
        xs: '12px',
        sm: '14px',
        base: '16px',
        lg: '18px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '30px',
        '4xl': '36px',
        '5xl': '48px',
        '6xl': '60px',
        '7xl': '72px',
        '8xl': '96px',
        '9xl': '128px',
      },
      // Border radius
      borderRadius: {
        none: '0px',
        sm: '2px',
        md: '4px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
        full: '9999px',
      },
      // Font families
      fontFamily: {
        pixel: ['Pixelary-Regular', 'Courier New', 'monospace'],
        mono: ['Pixelary-Regular', 'Courier New', 'monospace'],
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      // Box shadows
      boxShadow: {
        'pixel': '4px 4px 0px 0px rgba(0, 0, 0, 0.3)',
        'pixel-sm': '2px 2px 0px 0px rgba(0, 0, 0, 0.3)',
        'pixel-md': '4px 4px 0px 0px rgba(0, 0, 0, 0.3)',
        'pixel-lg': '8px 8px 0px 0px rgba(0, 0, 0, 0.3)',
        'pixel-xl': '12px 12px 0px 0px rgba(0, 0, 0, 0.3)',
      },
      // Animations
      animation: {
        'pixel-bounce': 'pixelBounce 1s ease-in-out infinite',
        'pixel-pulse': 'pixelPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pixel-fade-in': 'pixelFadeIn 0.3s ease-in-out',
        'pixel-slide-up': 'pixelSlideUp 0.3s ease-out',
        'pixel-slide-down': 'pixelSlideDown 0.3s ease-out',
      },
      // Keyframes
      keyframes: {
        pixelBounce: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        pixelPulse: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        pixelFadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pixelSlideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0px)', opacity: '1' },
        },
        pixelSlideDown: {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0px)', opacity: '1' },
        },
      },
      backgroundImage: {
        'stripes':
          'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)',
        'pixelary-bg': 'linear-gradient(135deg, #56ccf2 0%, #0e92be 100%)',
        'halloween-bg': 'linear-gradient(135deg, #1A0D00 0%, #2D1B00 100%)',
        'christmas-bg': 'linear-gradient(135deg, #0D3B2E 0%, #1B5E3A 100%)',
        'valentines-bg': 'linear-gradient(135deg, #2D0B2D 0%, #4A1A4A 100%)',
        'summer-bg': 'linear-gradient(135deg, #87CEEB 0%, #B0E0E6 100%)',
      },
      // Container queries support
      containers: {
        'xs': '320px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [
    // Custom plugin for CSS custom properties and pixel-perfect utilities
    function ({ addBase, addUtilities, theme }) {
      addBase({
        ':root': {
          // CSS custom properties for theme switching
          '--color-pixel-white': theme('colors.pixel.white'),
          '--color-pixel-black': theme('colors.pixel.black'),
          '--color-pixel-red': theme('colors.pixel.red'),
          '--color-pixel-orange': theme('colors.pixel.orange'),
          '--color-pixel-yellow': theme('colors.pixel.yellow'),
          '--color-pixel-green': theme('colors.pixel.green'),
          '--color-pixel-blue': theme('colors.pixel.blue'),
          '--color-pixel-purple': theme('colors.pixel.purple'),

          '--color-brand-primary': theme('colors.brand.primary'),
          '--color-brand-secondary': theme('colors.brand.secondary'),
          '--color-brand-tertiary': theme('colors.brand.tertiary'),
          '--color-brand-weak': theme('colors.brand.weak'),
          '--color-brand-background': theme('colors.brand.background'),
          '--color-brand-orangered': theme('colors.brand.orangered'),

          '--color-semantic-success': theme('colors.semantic.success'),
          '--color-semantic-error': theme('colors.semantic.error'),
          '--color-semantic-warning': theme('colors.semantic.warning'),
          '--color-semantic-info': theme('colors.semantic.info'),

          '--shadow-pixel': theme('boxShadow.pixel'),
          '--shadow-pixel-sm': theme('boxShadow.pixel-sm'),
          '--shadow-pixel-lg': theme('boxShadow.pixel-lg'),
        },
      });

      addUtilities({
        // Pixel-perfect rendering utilities
        '.pixel-perfect': {
          'image-rendering': 'pixelated',
          'image-rendering': '-moz-crisp-edges',
          'image-rendering': 'crisp-edges',
        },

        // Pixel border utilities
        '.pixel-border': {
          'border-width': '2px',
          'border-style': 'solid',
          'border-color': 'var(--color-brand-primary)',
        },

        // Pixel shadow utilities
        '.pixel-shadow': {
          'box-shadow': 'var(--shadow-pixel)',
        },
        '.pixel-shadow-sm': {
          'box-shadow': 'var(--shadow-pixel-sm)',
        },
        '.pixel-shadow-lg': {
          'box-shadow': 'var(--shadow-pixel-lg)',
        },

        // Animation utilities
        '.animate-pixel-bounce': {
          'animation': 'pixelBounce 1s ease-in-out infinite',
        },
        '.animate-pixel-pulse': {
          'animation': 'pixelPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        },
        '.animate-pixel-fade-in': {
          'animation': 'pixelFadeIn 0.3s ease-in-out',
        },
        '.animate-pixel-slide-up': {
          'animation': 'pixelSlideUp 0.3s ease-out',
        },
        '.animate-pixel-slide-down': {
          'animation': 'pixelSlideDown 0.3s ease-out',
        },

        // Reduced motion support
        '@media (prefers-reduced-motion: reduce)': {
          '.animate-pixel-bounce': {
            'animation': 'none',
          },
          '.animate-pixel-pulse': {
            'animation': 'none',
          },
        },

        // Pixel text scale utilities
        '.text-pixel-text-scale-1': { fontSize: '8px' },
        '.text-pixel-text-scale-1-2': { fontSize: '10px' },
        '.text-pixel-text-scale-1-5': { fontSize: '12px' },
        '.text-pixel-text-scale-2': { fontSize: '16px' },
        '.text-pixel-text-scale-2-5': { fontSize: '20px' },
        '.text-pixel-text-scale-3': { fontSize: '24px' },
        '.text-pixel-text-scale-4': { fontSize: '32px' },
        '.text-pixel-text-scale-5': { fontSize: '40px' },
        '.text-pixel-text-scale-6': { fontSize: '48px' },
        '.text-pixel-text-scale-8': { fontSize: '64px' },
        '.text-pixel-text-scale-10': { fontSize: '80px' },

        // Font family utilities
        '.font-pixel': {
          fontFamily: 'Pixelary-Regular, Courier New, monospace',
        },
        '.font-mono': {
          fontFamily: 'Pixelary-Regular, Courier New, monospace',
        },
      });
    },
  ],
} satisfies Config;
