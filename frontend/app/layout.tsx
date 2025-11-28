import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import ClientProviders from "./components/ClientProviders";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Cohort Builder",
  description: "Clinical cohort builder with natural language querying",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans bg-white`}>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
