import {
  PRIMARY_COLOR_PALETTE,
  SECONDARY_COLOR_PALETTE,
  TERTIARY_COLOR_PALETTE,
  FELT_PALETTE,
  PAPER_PALETTE,
  INK_PALETTE,
  SUIT_RED_PALETTE,
  GOLD_PALETTE,
  TEAM_PALETTE,
} from './shared/constants/colors';
import { FONT_DISPLAY, FONT_SANS } from './shared/constants/fonts';

export default {
  darkMode: ['class', '[data-mantine-color-scheme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: PRIMARY_COLOR_PALETTE,
        secondary: SECONDARY_COLOR_PALETTE,
        tertiary: TERTIARY_COLOR_PALETTE,
        felt: FELT_PALETTE,
        paper: PAPER_PALETTE,
        ink: INK_PALETTE,
        'suit-red': SUIT_RED_PALETTE,
        gold: GOLD_PALETTE,
        team: TEAM_PALETTE,
      },
      fontFamily: {
        display: FONT_DISPLAY,
        sans: FONT_SANS,
      },
      transitionTimingFunction: {
        deal: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
};
