// Minimal, dependency-free Markdown for the agent's streamed answers:
// **bold**, *italic*, `code`, [links](url), and - / 1. lists. Kept tiny so it
// renders progressively during streaming without pulling in a parser.

function renderInline(text, keyBase) {
  const nodes = [];
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  let m;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1]) nodes.push(<strong key={`${keyBase}-b${k}`} className="font-medium text-ink">{m[2]}</strong>);
    else if (m[3]) nodes.push(<em key={`${keyBase}-i${k}`}>{m[4]}</em>);
    else if (m[5]) nodes.push(<code key={`${keyBase}-c${k}`} className="rounded bg-surface-strong px-1 py-0.5 text-[12px]">{m[6]}</code>);
    else if (m[7]) nodes.push(<a key={`${keyBase}-a${k}`} href={m[9]} target="_blank" rel="noreferrer" className="text-link underline underline-offset-2">{m[8]}</a>);
    last = re.lastIndex;
    k += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function Markdown({ text }) {
  const lines = (text || "").split("\n");
  const blocks = [];
  let list = null;
  const flush = () => {
    if (list) blocks.push(list);
    list = null;
  };
  lines.forEach((line) => {
    const ul = /^\s*[-*]\s+(.*)/.exec(line);
    const ol = /^\s*\d+\.\s+(.*)/.exec(line);
    if (ul) {
      if (!list || list.type !== "ul") {
        flush();
        list = { type: "ul", items: [] };
      }
      list.items.push(ul[1]);
    } else if (ol) {
      if (!list || list.type !== "ol") {
        flush();
        list = { type: "ol", items: [] };
      }
      list.items.push(ol[1]);
    } else {
      flush();
      blocks.push({ type: "p", text: line });
    }
  });
  flush();

  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        if (b.type === "ul")
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it, `${i}-${j}`)}</li>
              ))}
            </ul>
          );
        if (b.type === "ol")
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it, `${i}-${j}`)}</li>
              ))}
            </ol>
          );
        if (!b.text.trim()) return null;
        return (
          <p key={i} className="leading-relaxed">
            {renderInline(b.text, i)}
          </p>
        );
      })}
    </div>
  );
}
