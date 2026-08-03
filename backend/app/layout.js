import "./globals.css";
import Link from "next/link";
import { Inter } from "next/font/google";
import { ClerkProvider, UserButton } from "@clerk/nextjs";

// Inter is the design's named substitute for Haas Grotesk.
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter" });

export const metadata = {
  title: "Visual AI Agent",
  description: "Browser activity monitoring — users, sessions, and an agent you can ask.",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
          {/* top-nav: 64px white bar, never inverted (DESIGN-airtable.md) */}
          <header className="sticky top-0 z-40 border-b border-hairline bg-canvas">
            <div className="mx-auto flex h-16 max-w-content items-center justify-between px-6 md:px-12">
              <Link href="/" className="flex items-center gap-2.5 text-[15px] tracking-tight text-ink">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-coral" />
                Visual AI Agent
              </Link>
              <UserButton />
            </div>
          </header>
          <main className="mx-auto max-w-content px-6 py-12 md:px-12">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
