// Shared design tokens.
// Any React (or canvas) UI should pull colors/fonts/sizes from here so visual
// drift across overlays, cards, and buttons stays bounded.

export const FONT = 'Fredoka, sans-serif';

export const color = {
  // Parchment / papyrus
  parchmentLight: '#fff7e0',
  parchment: '#ffe4b5',
  parchmentDeep: '#D7B48B',

  // Wood / brown scale (darkest → lightest)
  woodDarkest: '#3E2723',
  woodDark: '#4E342E',
  wood: '#6D4C41',
  woodMid: '#8D6E63',
  woodLight: '#A47F52',
  woodPale: '#C9A77A',
  woodCream: '#FFF5DC',

  // Gold accents
  goldLight: '#FFD54F',
  gold: '#FFB300',
  goldDeep: '#F9A825',
  goldBronze: '#C17A00',

  // Primary action (go / accept / confirm)
  greenLight: '#7CC07A',
  green: '#4CAF50',
  greenDark: '#2E7D32',
  greenDeepest: '#1B5E20',

  // Destructive
  redLight: '#EF5350',
  red: '#F44336',

  // Quest banner
  questBarBg: 'rgba(62,39,35,0.88)',
  questBarBorder: 'rgba(255,213,79,0.8)',
  questBarText: '#FFE0B2',

  // Overlays and veils
  overlay: 'rgba(0,0,0,0.6)',
  overlaySoft: 'rgba(0,0,0,0.55)',
} as const;

export const fontSize = {
  xxs: 10.5,
  xs: 11,
  sm: 13,
  base: 14,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  hero: 28,
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  '2xl': 16,
  '3xl': 22,
} as const;

export const shadow = {
  cardSoft: '0 4px 12px rgba(0,0,0,0.15)',
  card: '0 18px 50px rgba(0,0,0,0.55)',
  stone: '0 20px 40px rgba(0,0,0,0.5)',
  floating: '0 10px 28px rgba(0,0,0,0.35)',
} as const;

// Common gradients used across billboards, buttons, and placards.
export const gradient = {
  parchment: 'linear-gradient(180deg, #fff7e0 0%, #ffe4b5 100%)',
  parchmentPanel:
    'linear-gradient(180deg, rgba(231,205,155,0.55) 0%, rgba(206,176,123,0.45) 100%)',
  wood: 'linear-gradient(180deg, #C9A77A 0%, #A47F52 55%, #7A5A38 100%)',
  woodDim: 'linear-gradient(180deg, #A48E70 0%, #8B6F4E 55%, #6F4E37 100%)',
  woodPlaque: 'linear-gradient(180deg, #6D4C41 0%, #4E342E 100%)',
  primary: 'linear-gradient(180deg, #7CC07A 0%, #4CAF50 55%, #2E7D32 100%)',
  secondary: 'linear-gradient(180deg, #F3E0B3 0%, #DEC08C 55%, #B89266 100%)',
  goldCoin:
    'radial-gradient(circle at 50% 30%, #FFF3C4 0%, #FFD54F 50%, #F9A825 100%)',
} as const;

export const textShadow = {
  parchment: '0 1px 0 rgba(255,245,210,0.6)',
  carved: '0 1px 1px rgba(0,0,0,0.5)',
  soft: '0 1px 0 rgba(255,240,200,0.75), 0 2px 3px rgba(62,39,35,0.18)',
  plaque: '0 1px 2px rgba(0,0,0,0.45)',
} as const;

// Button bevel presets — keep the chunky "stone-bevel" look consistent.
export const bevel = {
  primary: {
    rest: `0 3px 0 ${color.greenDeepest}, 0 5px 10px rgba(46,125,50,0.35), inset 0 1px 0 rgba(255,255,255,0.35)`,
    pressed: `0 1px 0 ${color.greenDeepest}, 0 2px 6px rgba(46,125,50,0.35), inset 0 1px 0 rgba(255,255,255,0.35)`,
  },
  secondary: {
    rest: `0 3px 0 ${color.wood}, 0 5px 10px rgba(60,40,20,0.3), inset 0 1px 0 rgba(255,250,220,0.6)`,
    pressed: `0 1px 0 ${color.wood}, 0 2px 6px rgba(60,40,20,0.3), inset 0 1px 0 rgba(255,250,220,0.6)`,
  },
} as const;

// A tiny uppercase-label type preset used for subtitles and section headers.
export const label = {
  fontSize: fontSize.xs,
  textTransform: 'uppercase' as const,
  letterSpacing: 1.6,
  fontWeight: 600,
  color: color.wood,
};

