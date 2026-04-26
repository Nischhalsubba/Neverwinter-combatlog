using System.IO;
using System.Windows;
using Microsoft.Web.WebView2.Core;

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
        var userDataFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AstralCombat",
            "WebView2");
        Directory.CreateDirectory(userDataFolder);

        var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: userDataFolder);
        await WebView.EnsureCoreWebView2Async(environment);
        WebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
        WebView.CoreWebView2.AddHostObjectToScript("nexus", new NexusBridge());

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
                <h1>Astral Combat</h1>
                <p>Build the React UI first with <code>corepack pnpm --filter @nevercombat/desktop web:build</code>.</p>
              </body>
            </html>
            """);
    }
}
