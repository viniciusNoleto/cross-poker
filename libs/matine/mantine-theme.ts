import { createTheme } from '@mantine/core'
import {
  PRIMARY_COLOR_PALETTE,
  SECONDARY_COLOR_PALETTE,
  TERTIARY_COLOR_PALETTE,
  colorVariations
} from '../../shared/constants/colors'

export const mantineTheme = createTheme({
  primaryColor: 'primary',
  primaryShade: 5,
  autoContrast: true,
  luminanceThreshold: 0.45,
  fontFamily: "'Satoshi', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  headings: {
    fontFamily: "'Boska', 'Iowan Old Style', Georgia, serif",
    fontWeight: '500',
  },
  colors: {
    primary: Object.values(PRIMARY_COLOR_PALETTE) as any,
    secondary: Object.values(SECONDARY_COLOR_PALETTE) as any,
    tertiary: Object.values(TERTIARY_COLOR_PALETTE) as any,
    red: Object.values(colorVariations('#B3132B')) as any,
  },
  defaultRadius: 'xs',
  components: {
    Modal: {
      classNames: {
        title: 'text-2xl! font-display! font-medium! grow',
      },
    },
    Button: {
      classNames: {
        root: 'font-bold! tracking-[0.01em] transition-transform active:translate-y-px',
      },
    },
  },
})
