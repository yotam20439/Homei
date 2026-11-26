import type { Metadata, Viewport } from "next";
import "./globals.css";
import Splash from "@/components/Splash";

export const metadata: Metadata = {
  title: "HOMEi",
  description: "HOMEi: מעקב אחרי חשבונות, חוזים ומבצעים של הבית",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#111214", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;800;900&family=Varela+Round&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Splash />
        {children}
      </body>
    </html>
  );
}
