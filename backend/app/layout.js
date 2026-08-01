export const metadata = {
  title: "Visual AI Agent",
  description: "Browser activity ingestion API and dashboard.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background: "#1a1b1e",
          color: "#e8e9ec",
        }}
      >
        {children}
      </body>
    </html>
  );
}
