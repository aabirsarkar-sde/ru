import type { Metadata, Viewport } from "next";
import { EB_Garamond, Montserrat } from "next/font/google";
import "./globals.css";

// Adobe Garamond isn't available as a web font; EB Garamond is the closest
// open Garamond cut. It is used for headlines only — never to recreate the logo.
const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stage 2 Aptitude · Rishihood University",
  description: "The Stage 2 aptitude test for B.Design, B.Psych and BBA Entrepreneurship at Rishihood University.",
};

export const viewport: Viewport = {
  themeColor: "#B20E38",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${garamond.variable} ${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
