import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MonFlip | Monad Testnet",
  description: "BTC, ETH ve MON için kısa vadeli yön tahminleri. Yalnızca test MON.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
