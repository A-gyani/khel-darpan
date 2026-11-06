import { createTheme, responsiveFontSizes } from '@mui/material/styles'

// Colours taken from the Sports Authority of Gujarat logo (blue, orange, green figures).
export const brand = {
  blue: '#1B6FB8',
  blueDark: '#0D4A80',
  orange: '#F08A1C',
  green: '#2E9447',
}

// Material Design 3 style: tonal surfaces, rounded shapes, pill buttons.
export const theme = responsiveFontSizes(createTheme({
  palette: {
    primary: { main: brand.blue, dark: brand.blueDark, contrastText: '#fff' },
    secondary: { main: brand.orange, contrastText: '#fff' },
    success: { main: brand.green },
    background: { default: '#F7F9FC', paper: '#FFFFFF' },
    text: { primary: '#1A1C1E', secondary: '#43474E' },
    divider: '#DCE3EC',
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: 'Roboto, "Noto Sans Gujarati", system-ui, sans-serif',
    h1: { fontSize: '2rem', fontWeight: 500 },
    h2: { fontSize: '1.6rem', fontWeight: 500 },
    h3: { fontSize: '1.3rem', fontWeight: 500 },
    h4: { fontSize: '1.15rem', fontWeight: 500 },
    button: { textTransform: 'none', fontWeight: 500, letterSpacing: 0.1 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 100, minHeight: 44, paddingInline: 20 } },
    },
    MuiIconButton: { styleOverrides: { root: { width: 44, height: 44 } } },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { borderRadius: 16, border: '1px solid #DCE3EC' } },
    },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 16 } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 8, height: 34, fontWeight: 500 } } },
    MuiTextField: { defaultProps: { fullWidth: true, variant: 'outlined' } },
    // dropdown menus must not lock / reset the page scroll (form jumps on phones)
    MuiMenu: { defaultProps: { disableScrollLock: true } },
    MuiPopover: { defaultProps: { disableScrollLock: true } },
    MuiSelect: { defaultProps: { MenuProps: { disableScrollLock: true } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiAppBar: { defaultProps: { elevation: 0, color: 'inherit' } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 28 } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 500, minHeight: 48 } } },
    MuiFab: { styleOverrides: { root: { borderRadius: 16, textTransform: 'none' } } },
  },
}), { factor: 2.2 })
