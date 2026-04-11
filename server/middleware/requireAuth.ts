import { Request, Response, NextFunction } from "express";

/** Drop-in middleware — returns 401 if the request isn't authenticated. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  next();
}

/**
 * Validates a URL is safe to fetch (no SSRF to internal networks).
 * Returns true if the URL is safe, false otherwise.
 */
export function isSafeUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    // Block loopback, private ranges, link-local, AWS metadata
    if (
      host === "localhost" ||
      host === "::1" ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host) ||
      /^169\.254\./.test(host) ||   // link-local / AWS metadata
      host === "0.0.0.0" ||
      host === "metadata.google.internal"
    ) return false;
    return true;
  } catch {
    return false;
  }
}
