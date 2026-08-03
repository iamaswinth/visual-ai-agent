"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./dashboard.css";

const POLL_MS = 4000;

function fmtTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtDuration(a, b) {
  if (!a) return "";
  const end = b ? new Date(b) : new Date();
  const secs = Math.max(0, Math.round((end - new Date(a)) / 1000));
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// Location label for a session, from its captured IP geolocation.
function locationLabel(s) {
  if (s.city && s.country) return `${s.city}, ${s.country}`;
  if (s.country) return s.country;
  if (s.ip) return s.ip;
  return "Unknown location";
}

// Human-readable one-liner for the detail line under an event.
function eventDetail(e) {
  const d = e.data || {};
  switch (e.type) {
    case "navigation":
      return d.transitionType
        ? `${d.phase || "committed"} · ${d.transitionType}${
            (d.transitionQualifiers || []).length ? " · " + d.transitionQualifiers.join(",") : ""
          }`
        : d.phase || null;
    case "click":
      return [d.button && `${d.button}-click`, d.target?.text && `"${d.target.text}"`, d.target?.tag]
        .filter(Boolean)
        .join(" · ");
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
    case "tab_activated":
    case "tab_created":
    case "tab_closed":
    case "tab_updated":
      return d.status || (d.index != null ? `index ${d.index}` : null);
    case "window_focus":
      return d.focused ? "focused" : "blurred";
    case "session_start":
    case "session_end":
      return d.reason || null;
    default:
      return null;
  }
}

function StatTile({ value, label, cls }) {
  return (
    <div className="stat">
      <div className={`stat-value ${cls || ""}`}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState({ sessions: 0, events: 0, screenshots: 0, captioned: 0 });
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [captioning, setCaptioning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [note, setNote] = useState(null); // {kind, text}
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]); // {role, content, sources?, error?}
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  const refresh = useCallback(async () => {
    try {
      const [s, st] = await Promise.all([
        fetch("/api/sessions").then((r) => r.json()),
        fetch("/api/stats").then((r) => r.json()),
      ]);
      if (s.ok) {
        setSessions(s.sessions);
        // Auto-select the newest session on first load.
        if (!selectedRef.current && s.sessions.length) {
          setSelectedId(s.sessions[0].sessionId);
        }
      }
      if (st.ok) setStats(st.stats);
    } catch {
      /* transient; next poll retries */
    }
  }, []);

  const refreshDetail = useCallback(async (id) => {
    if (!id) return;
    try {
      const r = await fetch(`/api/sessions/${id}`).then((r) => r.json());
      if (r.ok) setDetail(r.session);
    } catch {
      /* ignore */
    }
  }, []);

  // Poll list + stats.
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // Poll the selected session's timeline.
  useEffect(() => {
    if (!selectedId) return;
    refreshDetail(selectedId);
    const t = setInterval(() => refreshDetail(selectedId), POLL_MS);
    return () => clearInterval(t);
  }, [selectedId, refreshDetail]);

  async function generateCaptions() {
    setCaptioning(true);
    setNote(null);
    try {
      const r = await fetch("/api/caption/run", { method: "POST" }).then((r) => r.json());
      if (r.ok) {
        setNote({ kind: "ok", text: `Captioned ${r.captioned} screenshot(s).` });
        await refresh();
        await refreshDetail(selectedRef.current);
      } else {
        setNote({ kind: "err", text: r.error || "captioning failed" });
      }
    } catch (e) {
      setNote({ kind: "err", text: e.message });
    } finally {
      setCaptioning(false);
    }
  }

  async function analyzeSessions() {
    setAnalyzing(true);
    setNote(null);
    try {
      const r = await fetch("/api/analyze/run", { method: "POST" }).then((r) => r.json());
      if (r.ok) {
        setNote({ kind: "ok", text: `Analyzed ${r.analyzed} session(s).` });
        await refresh();
        await refreshDetail(selectedRef.current);
      } else {
        setNote({ kind: "err", text: r.error || "analysis failed" });
      }
    } catch (e) {
      setNote({ kind: "err", text: e.message });
    } finally {
      setAnalyzing(false);
    }
  }

  async function indexActivity() {
    setIndexing(true);
    setNote(null);
    try {
      let total = 0;
      for (let i = 0; i < 25; i++) {
        const r = await fetch("/api/index/run", { method: "POST" }).then((r) => r.json());
        if (!r.ok) {
          setNote({ kind: "err", text: r.error || "indexing failed" });
          break;
        }
        total += r.indexed;
        setNote({ kind: "ok", text: `Indexed ${total} activity documents… (${r.remaining} left)` });
        await refresh();
        if (r.remaining === 0 || r.indexed === 0) {
          setNote({ kind: "ok", text: `Indexed ${total} activity documents — the agent can now search them.` });
          break;
        }
      }
    } catch (e) {
      setNote({ kind: "err", text: e.message });
    } finally {
      setIndexing(false);
    }
  }

  async function sendChat() {
    const q = chatInput.trim();
    if (!q || chatStreaming) return;
    const history = chatMessages.map((m) => ({ role: m.role, content: m.content }));
    setChatMessages((prev) => [...prev, { role: "user", content: q }, { role: "assistant", content: "", sources: [] }]);
    setChatInput("");
    setChatStreaming(true);
    const patchLast = (fn) =>
      setChatMessages((prev) => {
        const c = [...prev];
        c[c.length - 1] = fn(c[c.length - 1]);
        return c;
      });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, messages: history }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "chat failed" }));
        patchLast((m) => ({ ...m, content: err.error || "chat failed", error: true }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop();
        for (const p of parts) {
          const ev = /event: (.*)/.exec(p)?.[1];
          const dm = /data: ([\s\S]*)/.exec(p)?.[1];
          if (!dm) continue;
          let data;
          try {
            data = JSON.parse(dm);
          } catch {
            continue;
          }
          if (ev === "sources") patchLast((m) => ({ ...m, sources: data }));
          else if (ev === "delta") patchLast((m) => ({ ...m, content: m.content + data.text }));
          else if (ev === "error") patchLast((m) => ({ ...m, content: m.content + "\n[error generating answer]", error: true }));
        }
      }
    } catch (e) {
      patchLast((m) => ({ ...m, content: e.message, error: true }));
    } finally {
      setChatStreaming(false);
    }
  }

  const uncaptioned = stats.screenshots - stats.captioned;
  const unanalyzed = sessions.filter((s) => !s.analyzedAt).length;

  return (
    <div className="wrap">
      <div className="header">
        <div>
          <div className="title-row">
            <span className="rec-dot" aria-hidden />
            <h1 className="title">Visual AI Agent</h1>
          </div>
          <p className="subtitle">Browser activity captured by the extension, stored in Postgres.</p>
        </div>
        <div className="stats">
          <StatTile value={stats.sessions} label="Sessions" />
          <StatTile value={stats.events} label="Events" />
          <StatTile value={stats.screenshots} label="Screenshots" />
          <StatTile value={stats.captioned} label="AI captioned" cls="green" />
          <StatTile value={stats.indexed || 0} label="Indexed vectors" cls="accent" />
        </div>
      </div>

      <div className="toolbar">
        <button className="btn" onClick={indexActivity} disabled={indexing}>
          {indexing ? "Indexing…" : "⚡ Index activity"}
        </button>
        <button className="btn ghost" onClick={analyzeSessions} disabled={analyzing || unanalyzed <= 0}>
          {analyzing
            ? "Analyzing…"
            : unanalyzed > 0
              ? `Analyze sessions (${unanalyzed})`
              : "All sessions analyzed"}
        </button>
        <button className="btn ghost" onClick={generateCaptions} disabled={captioning || uncaptioned <= 0}>
          {captioning
            ? "Generating…"
            : uncaptioned > 0
              ? `Generate captions (${uncaptioned})`
              : "All screenshots captioned"}
        </button>
        <button className="btn ghost" onClick={() => setChatOpen((o) => !o)}>
          {chatOpen ? "Close chat" : "💬 Ask the agent"}
        </button>
        {note && <span className={`toolbar-note ${note.kind}`}>{note.text}</span>}
        <span className="live">
          <span className="dot" /> live · refreshes every {POLL_MS / 1000}s
        </span>
      </div>

      {chatOpen && (
        <div className="chat">
          <div className="chat-thread">
            {chatMessages.length === 0 && (
              <div className="chat-empty">
                Ask about the captured activity — e.g. “What did the user do today?”, “Any shopping
                sessions?”, “Where were users located?”
              </div>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} className={`bubble ${m.role} ${m.error ? "error" : ""}`}>
                <div className="bubble-text">
                  {m.content ||
                    (m.role === "assistant" && chatStreaming && i === chatMessages.length - 1 ? "…" : "")}
                </div>
                {m.role === "assistant" && m.sources?.length > 0 && (
                  <div className="bubble-sources">
                    sources: {m.sources.map((s) => s.title).filter(Boolean).join(" · ") || "—"}
                  </div>
                )}
              </div>
            ))}
          </div>
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              sendChat();
            }}
          >
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask the agent about the activity…"
              disabled={chatStreaming}
            />
            <button className="btn" type="submit" disabled={chatStreaming || !chatInput.trim()}>
              {chatStreaming ? "…" : "Send"}
            </button>
          </form>
        </div>
      )}

      <div className="grid">
        <div className="panel">
          <div className="panel-head">Sessions</div>
          <div className="session-list">
            {sessions.length === 0 && (
              <div className="empty">
                No sessions yet.
                <br />
                Run <code>npm run seed</code> or load the extension and browse.
              </div>
            )}
            {sessions.map((s) => (
              <div
                key={s.sessionId}
                className={`session-card ${s.sessionId === selectedId ? "active" : ""}`}
                onClick={() => setSelectedId(s.sessionId)}
              >
                <div className="session-id" style={{ fontFamily: "inherit", fontWeight: 600 }}>
                  {s.aiTitle || `📍 ${locationLabel(s)}`}
                </div>
                <div className="session-meta">
                  {s.aiCategory && <span className="cat">{s.aiCategory}</span>}
                  <span>📍 {locationLabel(s)}</span>
                  <span>{fmtTime(s.startedAt)}</span>
                  <span>{s.eventCount} events</span>
                  <span>{s.screenshotCount} shots</span>
                </div>
                {s.domains.length > 0 && (
                  <div className="session-domains">
                    {s.domains.map((d) => (
                      <span className="chip" key={d}>
                        {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="panel detail">
          {!detail ? (
            <div className="empty">Select a session to view its activity timeline.</div>
          ) : (
            <>
              <div className="detail-head">
                <div>
                  <div className="detail-title">{detail.aiTitle || `📍 ${locationLabel(detail)}`}</div>
                  <div className="detail-sub">
                    📍 {locationLabel(detail)}
                    {detail.ip ? ` · ${detail.ip}` : ""} · {fmtTime(detail.startedAt)} ·{" "}
                    {detail.events.length} events · {fmtDuration(detail.startedAt, detail.endedAt)}
                  </div>
                </div>
              </div>
              {detail.aiSummary ? (
                <div className="ai-card">
                  <div className="ai-card-head">
                    <span className="ai-badge">AI</span>
                    {detail.aiCategory && <span className="cat">{detail.aiCategory}</span>}
                  </div>
                  <p className="ai-summary">{detail.aiSummary}</p>
                  {detail.aiInsights?.length > 0 && (
                    <ul className="ai-insights">
                      {detail.aiInsights.map((it, i) => (
                        <li key={i}>{it}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="ai-hint">Not analyzed yet — click “Analyze sessions” to have the agent summarize this session.</div>
              )}
              <div className="timeline">
                {detail.events.map((e) => (
                  <div key={e.id}>
                    <div className="event">
                      <span className="event-time">{fmtTime(e.ts)}</span>
                      <span className="event-rail">
                        <span className="event-node" />
                      </span>
                      <span className="event-body">
                        <span className={`event-type ${e.type}`}>{e.type.replace(/_/g, " ")}</span>
                        {e.title && <strong>{e.title}</strong>}
                        {e.url && <div className="event-url">{e.url}</div>}
                        {eventDetail(e) && <div className="event-detail">{eventDetail(e)}</div>}
                      </span>
                    </div>
                    {e.screenshotId && (
                      <div className="shot">
                        <img
                          src={`/api/screenshots/${e.screenshotId}`}
                          alt={e.caption || "screenshot"}
                          loading="lazy"
                        />
                        <div className="shot-body">
                          {e.caption ? (
                            <div className="shot-caption">
                              <span className="ai">AI</span>
                              {e.caption}
                            </div>
                          ) : (
                            <div className="shot-caption pending">
                              Not yet captioned — click “Generate captions”.
                            </div>
                          )}
                          {e.trigger && <div className="shot-trigger">trigger: {e.trigger}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
