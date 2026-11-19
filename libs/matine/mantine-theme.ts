import { createTheme } from '@mantine/core'
import {
  PRIMARY_COLOR_PALETTE,
  SECONDARY_COLOR_PALETTE,
  TERTIARY_COLOR_PALETTE,
  SUIT_RED_PALETTE,
  colorVariations
} from '../../shared/constants/colors'
import { FONT_DISPLAY, FONT_SANS } from '../../shared/constants/fonts'

export const mantineTheme = createTheme({
  primaryColor: 'primary',
  primaryShade: 5,
  autoContrast: true,
  luminanceThreshold: 0.45,
  fontFamily: FONT_SANS,
  headings: {
    fontFamily: FONT_DISPLAY,
    fontWeight: '500',
  },
  colors: {
    primary: Object.values(PRIMARY_COLOR_PALETTE) as any,
    secondary: Object.values(SECONDARY_COLOR_PALETTE) as any,
    tertiary: Object.values(TERTIARY_COLOR_PALETTE) as any,
    red: Object.values(colorVariations(SUIT_RED_PALETTE.DEFAULT)) as any,
  },
  defaultRadius: 'xs',
  components: {
    ActionIcon: {
      defaultProps: {
        radius: 6,
      },
    },
    SegmentedControl: {
      defaultProps: {
        radius: 6,
      },
    },
    Modal: {
      classNames: {
        title: 'text-2xl! font-display! font-medium! grow',
      },
    },
    Button: {
      defaultProps: {
        radius: 6,
      },
      classNames: {
        root: 'font-bold! tracking-[0.01em] transition-transform active:translate-y-px',
      },
    },
  },
})
