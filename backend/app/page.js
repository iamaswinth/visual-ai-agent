import Dashboard from "./components/Dashboard.js";

// The dashboard is a live, data-driven client app; render it dynamically
// rather than statically prerendering at build time.
export const dynamic = "force-dynamic";

export default function Home() {
  return <Dashboard />;
}
