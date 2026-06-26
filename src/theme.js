import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      light: '#5e92f3',
      main: '#1565C0',
      dark: '#0d47a1',
      contrastText: '#fff',
    },
    secondary: {
      light: '#4fb3bf',
      main: '#00838F',
      dark: '#005662',
      contrastText: '#fff',
    },
    success: { main: '#2E7D32' },
    error: { main: '#C62828' },
    warning: { main: '#EF6C00' },
    info: { main: '#0277BD' },
    background: {
      default: '#f0f4f8',
      paper: '#ffffff',
    },
    text: {
      primary: '#1a2332',
      secondary: '#5a6a7e',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system', 'BlinkMacSystemFont', '"PingFang SC"',
      '"Segoe UI"', '"Helvetica Neue"', 'Arial', 'sans-serif',
    ].join(','),
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, #1565C0 0%, #00838F 100%)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', borderRadius: 8 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 12px rgba(21, 101, 192, 0.08)',
          borderRadius: 12,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: '#fafbfc', borderRight: '1px solid #e8edf2' },
      },
    },
  },
});

export default theme;
