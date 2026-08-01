import type { Metadata } from "next";
import { DM_Sans, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AiDHD — Concierge for group nights & trips",
  description:
    "Group nights out and weekend trips from the same chat. AiDHD builds costed plans and books with scoped Prava payments per category.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${dmSans.variable} h-full`}>
      <body className="min-h-full antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
