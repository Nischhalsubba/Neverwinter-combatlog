import { createTheme } from "@mui/material/styles";

export const muiTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#00a7b5",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#2fbf71",
    },
    success: {
      main: "#237a3b",
    },
    warning: {
      main: "#8b6200",
    },
    error: {
      main: "#b82f29",
    },
    background: {
      default: "#f8fbf8",
      paper: "#ffffff",
    },
    text: {
      primary: "#161a18",
      secondary: "#65706a",
    },
    divider: "rgba(16, 18, 17, 0.10)",
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
    h1: {
      fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
      fontSize: "2.5rem",
      fontWeight: 800,
      lineHeight: 1.1,
      letterSpacing: 0,
    },
    h2: {
      fontSize: "1.25rem",
      fontWeight: 800,
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
          boxShadow: "rgba(16, 18, 17, 0.10) 0 18px 42px",
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
