import { createTheme } from "@mui/material/styles";

export const muiTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0f766e",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#475569",
    },
    success: {
      main: "#237a3b",
    },
    warning: {
      main: "#8b6200",
    },
    error: {
      main: "#b42318",
    },
    background: {
      default: "#f5f7fa",
      paper: "#ffffff",
    },
    text: {
      primary: "#101828",
      secondary: "#667085",
    },
    divider: "rgba(16, 24, 40, 0.10)",
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: 'Aptos, "Segoe UI", Inter, Arial, sans-serif',
    h1: {
      fontFamily: 'Aptos, "Segoe UI", Inter, Arial, sans-serif',
      fontSize: "2.5rem",
      fontWeight: 700,
      lineHeight: 1.1,
      letterSpacing: 0,
    },
    h2: {
      fontSize: "1.25rem",
      fontWeight: 700,
      letterSpacing: 0,
    },
    button: {
      textTransform: "none",
      fontWeight: 500,
      letterSpacing: 0,
    },
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          minHeight: 38,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: "rgba(16, 24, 40, 0.06) 0 12px 28px",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});
