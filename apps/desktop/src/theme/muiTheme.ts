import { createTheme } from "@mui/material/styles";

export const muiTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0071e3",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#5856d6",
    },
    success: {
      main: "#237a3b",
    },
    warning: {
      main: "#8a5a00",
    },
    error: {
      main: "#b3261e",
    },
    background: {
      default: "#f5f5f7",
      paper: "#ffffff",
    },
    text: {
      primary: "#1d1d1f",
      secondary: "rgba(0, 0, 0, 0.72)",
    },
    divider: "rgba(0, 0, 0, 0.08)",
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '"SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif',
    h1: {
      fontFamily: '"SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif',
      fontSize: "2.5rem",
      fontWeight: 600,
      lineHeight: 1.1,
      letterSpacing: 0,
    },
    h2: {
      fontSize: "1.25rem",
      fontWeight: 600,
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
          minHeight: 40,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: "rgba(0, 0, 0, 0.12) 3px 5px 30px 0",
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
