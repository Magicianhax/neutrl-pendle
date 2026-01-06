import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Neutral YT Calculator | Estimate Pendle Yield Token Returns & Points",
  description:
    "Calculate estimated points, yield, and ROI for Neutral NUSD & sNUSD markets on Pendle Finance. Project future points value based on inflation data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
