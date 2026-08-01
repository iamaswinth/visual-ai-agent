// Placeholder landing page. The activity dashboard is a later milestone;
// for now this just confirms the app is up and points at the API.

export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 24 }}>Visual AI Agent</h1>
      <p style={{ color: "#9a9ca3", lineHeight: 1.6 }}>
        Ingestion API for browser-activity batches posted by the Chrome
        extension. Data is stored in Postgres (NeonDB).
      </p>
      <ul style={{ color: "#9a9ca3", lineHeight: 1.8 }}>
        <li>
          <code>POST /api/ingest</code> — receive an activity batch
        </li>
        <li>
          <code>GET /api/health</code> — liveness + DB check
        </li>
      </ul>
      <p style={{ color: "#7fae7f" }}>
        The activity dashboard is the next milestone.
      </p>
    </main>
  );
}
