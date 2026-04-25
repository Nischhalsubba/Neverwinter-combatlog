using System.IO;
using System.Windows;

namespace NexusCombatAnalyzer.Host;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        await WebView.EnsureCoreWebView2Async();
        WebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;

        var devUrl = Environment.GetEnvironmentVariable("NCA_WEB_DEV_URL");
        if (!string.IsNullOrWhiteSpace(devUrl))
        {
            WebView.CoreWebView2.Navigate(devUrl);
            return;
        }

        var webIndex = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "desktop", "dist", "index.html"));
        if (File.Exists(webIndex))
        {
            WebView.Source = new Uri(webIndex);
            return;
        }

        WebView.NavigateToString("""
            <html>
              <body style="font-family:Segoe UI,Arial;background:#1b1b1b;color:white;padding:32px">
                <h1>Nexus Combat Analyzer</h1>
                <p>Build the React UI first with <code>corepack pnpm --filter @nevercombat/desktop web:build</code>.</p>
              </body>
            </html>
            """);
    }
}
