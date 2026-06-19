import type { Metadata, Viewport } from "next";
import "./globals.css";
import { GameStoreProvider } from "@/components/GameStore";

export const metadata: Metadata = {
  title: "Dashverse",
  description: "An infinite side-scrolling adventure — dash through boundless worlds",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dashverse",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-black">
        <GameStoreProvider>
          {children}
        </GameStoreProvider>
      </body>
    </html>
  );
}
