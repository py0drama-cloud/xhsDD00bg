import type { Metadata, Viewport } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "RoWorth",
  description: "Маркетплейс для Roblox",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head />
      <body style={{ margin: 0, padding: 0 }}>
        {/*
          beforeInteractive = загружается ДО гидрации React.
          Гарантирует что window.Telegram.WebApp доступен
          когда useEffect в page.tsx запустится.
        */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        {/* Telegram Login Widget — только для браузера */}
        <Script
          src="https://telegram.org/js/telegram-widget.js?22"
          strategy="lazyOnload"
        />
        {children}
      </body>
    </html>
  );
}