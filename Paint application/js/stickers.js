/* ==========================================================================
   CanvasPro - Stickers and Vector Assets Library
   ========================================================================== */

const StickersLibrary = {
  categories: {
    emojis: [
      '🔥', '🚀', '⭐', '✨', '💡', '🎨', '🌈', '👑',
      '💎', '🍕', '🐱', '😎', '⚡', '🎉', '💯', '❤️',
      '👍', '🎯', '🏆', '☕', '🌟', '🦄', '🍀', '🍎'
    ],
    badges: [
      {
        name: 'Verified',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="45" fill="#3b82f6"/>
          <path d="M30 50 L45 65 L72 35" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`
      },
      {
        name: 'Hot Deal',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 5 L63 32 L95 36 L72 58 L78 90 L50 74 L22 90 L28 58 L5 36 L37 32 Z" fill="#ef4444"/>
          <text x="50" y="56" fill="#ffffff" font-size="16" font-weight="bold" text-anchor="middle" font-family="sans-serif">HOT</text>
        </svg>`
      },
      {
        name: 'Top Rated',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="45" fill="#f59e0b"/>
          <polygon points="50,15 61,38 86,41 68,59 73,84 50,71 27,84 32,59 14,41 39,38" fill="#ffffff"/>
        </svg>`
      },
      {
        name: '100% Quality',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="10" width="80" height="80" rx="20" fill="#10b981"/>
          <text x="50" y="58" fill="#ffffff" font-size="24" font-weight="900" text-anchor="middle" font-family="sans-serif">100%</text>
        </svg>`
      },
      {
        name: 'Sale Tag',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 15 L55 15 L90 50 L55 85 L15 85 Z" fill="#ec4899"/>
          <circle cx="35" cy="50" r="8" fill="#ffffff"/>
        </svg>`
      },
      {
        name: 'Best Choice',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#6366f1" stroke-width="8"/>
          <circle cx="50" cy="50" r="32" fill="#6366f1"/>
          <path d="M36 50 L46 60 L64 42" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
        </svg>`
      },
      {
        name: 'Shield',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 10 L85 25 C85 65 50 90 50 90 C50 90 15 65 15 25 Z" fill="#8b5cf6"/>
          <path d="M50 20 L75 32 C75 62 50 80 50 80 Z" fill="#a78bfa"/>
        </svg>`
      },
      {
        name: 'Diamond',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <polygon points="50,15 88,40 50,88 12,40" fill="#06b6d4"/>
          <polygon points="50,15 68,40 50,88 32,40" fill="#67e8f9"/>
        </svg>`
      }
    ],
    arrows: [
      {
        name: 'Bold Right',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 40 L55 40 L55 20 L85 50 L55 80 L55 60 L20 60 Z" fill="#f43f5e"/>
        </svg>`
      },
      {
        name: 'Curved Arrow',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 75 C20 35 45 25 70 30" fill="none" stroke="#3b82f6" stroke-width="10" stroke-linecap="round"/>
          <polygon points="65,15 88,32 68,48" fill="#3b82f6"/>
        </svg>`
      },
      {
        name: 'Neon Pointer',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <line x1="20" y1="50" x2="75" y2="50" stroke="#10b981" stroke-width="12" stroke-linecap="round"/>
          <polyline points="55,30 80,50 55,70" fill="none" stroke="#10b981" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`
      },
      {
        name: 'Double Arrow',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <polyline points="25,30 45,50 25,70" fill="none" stroke="#eab308" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="55,30 75,50 55,70" fill="none" stroke="#eab308" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`
      }
    ],
    shapes: [
      {
        name: 'Speech Bubble',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 25 C15 15 25 15 35 15 L75 15 C85 15 85 25 85 25 L85 55 C85 65 75 65 65 65 L35 65 L20 85 L25 65 L15 65 Z" fill="#6366f1"/>
        </svg>`
      },
      {
        name: 'Heart',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 82 C50 82 15 55 15 35 C15 22 25 15 37 15 C45 15 50 22 50 22 C50 22 55 15 63 15 C75 15 85 22 85 35 C85 55 50 82 50 82 Z" fill="#ec4899"/>
        </svg>`
      },
      {
        name: 'Sun Burst',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="22" fill="#fbbf24"/>
          <g stroke="#fbbf24" stroke-width="6" stroke-linecap="round">
            <line x1="50" y1="12" x2="50" y2="20"/>
            <line x1="50" y1="80" x2="50" y2="88"/>
            <line x1="12" y1="50" x2="20" y2="50"/>
            <line x1="80" y1="50" x2="88" y2="50"/>
            <line x1="23" y1="23" x2="29" y2="29"/>
            <line x1="71" y1="71" x2="77" y2="77"/>
            <line x1="23" y1="77" x2="29" y2="71"/>
            <line x1="71" y1="29" x2="77" y2="23"/>
          </g>
        </svg>`
      },
      {
        name: 'Lightning',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <polygon points="55,10 25,52 48,52 38,90 75,44 52,44" fill="#facc15"/>
        </svg>`
      }
    ],
    decorative: [
      {
        name: 'Sparkle Star',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 10 Q50 50 90 50 Q50 50 50 90 Q50 50 10 50 Q50 50 50 10 Z" fill="#38bdf8"/>
        </svg>`
      },
      {
        name: 'Ribbon Banner',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 35 L90 35 L80 55 L90 75 L10 75 L20 55 Z" fill="#8b5cf6"/>
          <rect x="20" y="35" width="60" height="40" fill="#a78bfa"/>
        </svg>`
      },
      {
        name: 'Crown',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <polygon points="15,75 85,75 80,35 60,55 50,25 40,55 20,35" fill="#f59e0b"/>
          <circle cx="50" cy="22" r="5" fill="#ef4444"/>
          <circle cx="20" cy="32" r="4" fill="#3b82f6"/>
          <circle cx="80" cy="32" r="4" fill="#10b981"/>
        </svg>`
      },
      {
        name: 'Award Medal',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <polygon points="35,50 25,90 50,75 75,90 65,50" fill="#ef4444"/>
          <circle cx="50" cy="40" r="28" fill="#fbbf24"/>
          <circle cx="50" cy="40" r="22" fill="#f59e0b"/>
          <polygon points="50,24 55,34 66,35 58,43 60,54 50,49 40,54 42,43 34,35 45,34" fill="#ffffff"/>
        </svg>`
      }
    ]
  }
};
