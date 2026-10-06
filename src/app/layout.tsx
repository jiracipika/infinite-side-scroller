import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { GameStoreProvider } from "@/components/GameStore";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

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
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4128325832827761"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <GameStoreProvider>
          {children}
        </GameStoreProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
