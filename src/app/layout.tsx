import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Serif_JP, Zen_Kurenaido } from "next/font/google";
import RegisterServiceWorker from "@/components/pwa/register-service-worker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerifJp = Noto_Serif_JP({
  variable: "--font-noto-serif-jp",
  weight: ["400", "600", "700"],
});

const zenKurenaido = Zen_Kurenaido({
  variable: "--font-zen-kurenaido",
  weight: "400",
});

const THEME_COLOR = "#f43f5e";

export const metadata: Metadata = {
  title: "AiAi — ふたりのAIアドバイザー",
  description:
    "AiAiは、カップルのすれ違いをやさしくほどくAIアドバイザーです。相談内容はあなただけのもの。AIがパートナーのことを学び、的確なアドバイスをお届けします。",
  applicationName: "AiAi",
  appleWebApp: {
    capable: true,
    title: "AiAi",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSerifJp.variable} ${zenKurenaido.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
