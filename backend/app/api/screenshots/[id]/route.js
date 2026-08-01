// GET /api/screenshots/[id] — stream the stored screenshot bytes as an image.
// This is the target of <img src> in the dashboard gallery.

import { getScreenshotBytes } from "../../../../lib/queries.js";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const row = await getScreenshotBytes(id);
    if (!row) {
      return new Response("not found", { status: 404 });
    }
    // pg returns bytea as a Node Buffer.
    return new Response(row.bytes, {
      status: 200,
      headers: {
        "Content-Type": row.mime || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[screenshot] failed:", err);
    return new Response("error", { status: 500 });
  }
}
