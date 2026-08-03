// Shared display helpers for the dashboard client components.

export function fmtTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function fmtRelative(ts) {
  if (!ts) return "never";
  const s = Math.max(0, Math.round((Date.now() - new Date(ts)) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function fmtDuration(a, b) {
  if (!a) return "";
  const secs = Math.max(0, Math.round(((b ? new Date(b) : new Date()) - new Date(a)) / 1000));
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function locationLabel(o) {
  if (o?.city && o?.country) return `${o.city}, ${o.country}`;
  return o?.country || o?.ip || "Unknown location";
}

export function initials(name, email) {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

export function eventDetail(e) {
  const d = e.data || {};
  switch (e.type) {
    case "navigation":
      return d.transitionType ? `${d.phase || "committed"} · ${d.transitionType}` : d.phase || null;
    case "click":
      return [d.button && `${d.button}-click`, d.target?.text && `"${d.target.text}"`, d.target?.tag].filter(Boolean).join(" · ");
    case "scroll":
      return d.depthPct != null ? `scroll depth ${d.depthPct}%` : null;
    case "idle_state":
      return d.state ? `state: ${d.state}` : null;
    case "visibility":
      return d.state || null;
    case "selection":
      return d.length != null ? `${d.length} chars selected` : null;
    case "copy":
      return d.length != null ? `${d.length} chars copied` : null;
    case "download":
      return [d.filename, d.state, d.mime].filter(Boolean).join(" · ") || d.phase || null;
    case "session_start":
    case "session_end":
      return d.reason || null;
    default:
      return d.status || null;
  }
}
