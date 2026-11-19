import Color from 'color'

export const PRIMARY_COLOR = '#17603F'

export const SECONDARY_COLOR = '#F2B739'

export const TERTIARY_COLOR = '#B3132B'

export const PRIMARY_COLOR_PALETTE = colorVariations(PRIMARY_COLOR)

export const SECONDARY_COLOR_PALETTE = colorVariations(SECONDARY_COLOR)

export const TERTIARY_COLOR_PALETTE = colorVariations(TERTIARY_COLOR)

/*
 * Cross Poker — paletas do jogo. As cores saem do próprio jogo: o feltro da mesa, o papel da
 * carta, o vermelho dos naipes e o dourado do logo. Viram classes do Tailwind (`bg-felt-night`,
 * `text-gold-ink`, `bg-paper-2`, `text-team-a`...) via `tailwind.config.mjs`; use as constantes
 * diretamente só onde precisar da cor em JS (SVG, style inline).
 */
export const FELT_PALETTE = {
  DEFAULT: '#0f4a33',
  deep: '#0a3424',
  night: '#061f16',
  light: '#17603f',
  line: '#1f7350',
}

export const PAPER_PALETTE = {
  DEFAULT: '#f4f4f1',
  2: '#e9e9e4',
  3: '#dcdcd5',
  face: '#fcfbf7',
}

export const INK_PALETTE = {
  DEFAULT: '#17140f',
  soft: '#4b463d',
}

export const SUIT_RED_PALETTE = {
  DEFAULT: '#b3132b',
  deep: '#8a0f22',
}

export const GOLD_PALETTE = {
  DEFAULT: '#f2b739',
  deep: '#c98f12',
  ink: '#2b1d03',
}

export const TEAM_PALETTE = {
  a: GOLD_PALETTE.DEFAULT,
  b: '#ef6f7f',
}


function lighten(clr, val) {
  return Color(clr).lighten(val).hex();
}

function darken(clr, val) {
  return Color(clr).darken(val).hex();
}

export function colorVariations(color) {
  return {
    50: lighten(color, 0.5),
    100: lighten(color, 0.4),
    200: lighten(color, 0.3),
    300: lighten(color, 0.2),
    400: lighten(color, 0.1),
    500: color,
    600: darken(color, 0.1),
    700: darken(color, 0.2),
    800: darken(color, 0.3),
    900: darken(color, 0.4),
    950: darken(color, 0.5),
  };
}
