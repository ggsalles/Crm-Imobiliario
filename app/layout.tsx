import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { DatabaseStatusBanner } from "@/components/DatabaseStatusBanner";
import { BillingAlertBanner } from "@/components/BillingAlertBanner";
import { NewLeadSoundNotifier } from "@/components/NewLeadSoundNotifier";
import { NavigationProgress } from "@/components/NavigationProgress";
import { ModuleAccessTracker } from "@/components/audit/ModuleAccessTracker";
import { Suspense } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SalesScore",
  description: "CRM mobiliário de elite com inteligência preditiva e resiliência de dados em tempo real.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function checkAndRecover(msg, src) {
                  msg = msg || '';
                  src = src || '';
                  var isChunkErr = msg.indexOf('Loading chunk') !== -1 || 
                                   msg.indexOf('ChunkLoadError') !== -1 || 
                                   ((msg.indexOf('Unexpected token') !== -1 || msg.indexOf('Invalid or unexpected token') !== -1) && (src.indexOf('/_next/') !== -1 || src.indexOf('chunks') !== -1));
                  if (isChunkErr) {
                    var last = sessionStorage.getItem('chunk_recovery_ts');
                    var now = Date.now();
                    if (!last || (now - parseInt(last, 10) > 10000)) {
                      sessionStorage.setItem('chunk_recovery_ts', String(now));
                      window.location.reload();
                      return true;
                    }
                  }
                  return false;
                }
                window.addEventListener('error', function(e) {
                  if (checkAndRecover(e && e.message, e && e.filename)) {
                    if (e.preventDefault) e.preventDefault();
                  }
                });
                window.addEventListener('unhandledrejection', function(e) {
                  var r = e && e.reason;
                  var msg = (r && (r.message || r.name)) || String(r || '');
                  if (checkAndRecover(msg, '')) {
                    if (e.preventDefault) e.preventDefault();
                  }
                });
              })();
            `
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <Suspense fallback={null}>
              <NavigationProgress />
              <ModuleAccessTracker />
            </Suspense>
            <DatabaseStatusBanner />
            <BillingAlertBanner />
            <NewLeadSoundNotifier />
            {children}
            <Toaster position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

