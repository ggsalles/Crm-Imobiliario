import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { DatabaseStatusBanner } from "@/components/DatabaseStatusBanner";
import { BillingAlertBanner } from "@/components/BillingAlertBanner";
import { NewLeadSoundNotifier } from "@/components/NewLeadSoundNotifier";

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
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
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

