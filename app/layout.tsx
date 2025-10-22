import type { Metadata } from "next";
import { Work_Sans } from "next/font/google";
import "./globals.css";

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: '--font-word-sans',
  weight: ['400', '600', '700']
})
export const metadata: Metadata = {
  title: "SketchSync",
  description: "Real-time collaborative drawing application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${workSans} bg-primary-grey-200`}>
        {children}
      </body>
    </html>
  );
}
