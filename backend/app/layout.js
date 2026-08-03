import { ClerkProvider, UserButton } from "@clerk/nextjs";

export const metadata = {
  title: "Visual AI Agent",
  description: "Browser activity ingestion API and dashboard.",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          style={{
            margin: 0,
            fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            background: "#16171a",
            color: "#e8e9ec",
          }}
        >
          {/* UserButton self-hides when signed out; shows a sign-out menu when authed. */}
          <div style={{ position: "fixed", top: 14, right: 18, zIndex: 50 }}>
            <UserButton />
          </div>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
