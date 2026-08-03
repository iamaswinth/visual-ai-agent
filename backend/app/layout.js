import "./globals.css";
import Link from "next/link";
import { ClerkProvider, UserButton } from "@clerk/nextjs";

export const metadata = {
  title: "Visual AI Agent",
  description: "Browser activity monitoring — users, sessions, and an agent you can ask.",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body className="min-h-screen bg-background text-foreground antialiased">
          <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.15)]" />
                Visual AI Agent
              </Link>
              <UserButton />
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
