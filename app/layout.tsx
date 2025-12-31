import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from '../components/AppShell';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LOW VOLT MGR",
  description: "Field Logistics System",
  manifest: "/manifest.json", // CONNECTS PWA
};

// LOCKS ZOOM ON MOBILE (Feels Native)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-800 antialiased`}>
        <AppShell>
            {children}
        </AppShell>
      </body>
    </html>
  );
}