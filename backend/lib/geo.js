// Derive the ingesting client's IP + approximate location from request headers.
//
// On Vercel, every request carries geolocation headers (x-vercel-ip-*) for free
// — no external API. Locally those headers are absent, so only the IP (if any)
// is captured and location stays null.

function decode(v) {
  if (!v) return null;
  try {
    return decodeURIComponent(v); // Vercel URL-encodes city/region (e.g. "San%20Francisco")
  } catch {
    return v;
  }
}

/**
 * @param {Headers} headers - a Web Headers object (has .get)
 * @returns {{ip:string|null, city:string|null, country:string|null, region:string|null}}
 */
export function metaFromHeaders(headers) {
  const fwd = headers.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0].trim() : null) || headers.get("x-real-ip") || null;
  return {
    ip,
    city: decode(headers.get("x-vercel-ip-city")),
    country: headers.get("x-vercel-ip-country") || null, // 2-letter code, e.g. "US"
    region: decode(headers.get("x-vercel-ip-country-region")), // e.g. "CA"
  };
}
