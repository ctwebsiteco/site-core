// Parse a raw Cookie header into the shape @supabase/ssr expects.
// @supabase/ssr splits large session cookies into chunks; we return every
// cookie and let the library reassemble.

export type ParsedCookie = { name: string; value: string }

export function parseCookieHeader(cookieHeader: string | null | undefined): ParsedCookie[] {
  if (!cookieHeader) return []
  return cookieHeader
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const eqIdx = pair.indexOf('=')
      if (eqIdx === -1) return { name: pair, value: '' }
      const name = pair.slice(0, eqIdx).trim()
      const raw = pair.slice(eqIdx + 1).trim()
      let value: string
      try {
        value = decodeURIComponent(raw)
      } catch {
        value = raw
      }
      return { name, value }
    })
}
