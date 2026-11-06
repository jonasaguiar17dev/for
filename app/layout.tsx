import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "sonner";

import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], weight: ["600", "700"] });

export const metadata: Metadata = {
  title: { default: "Aguiar ERP", template: "%s · Aguiar ERP" },
  description: "Plataforma de gestão da Aguiar Contabilidade & Gestão.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#1C1917",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable} h-full`}>
      <body className="min-h-full">
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
