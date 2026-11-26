import type { Metadata, Viewport } from "next";
import "./globals.css";
import Splash from "@/components/Splash";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "HOMEi",
  description: "HOMEi: מעקב אחרי חשבונות, חוזים ומבצעים של הבית",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#111214" },
    { media: "(prefers-color-scheme: light)", color: "#F6F1F8" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("homei_theme")?.value;
  // Default is dark; "system" follows the device.
  const dataTheme = theme === "light" ? "light" : theme === "system" ? undefined : "dark";
  return (
    <html lang="he" dir="rtl" data-theme={dataTheme}>
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
