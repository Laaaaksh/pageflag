/**
 * An empty allow-list means the project has not locked itself down yet - allow any
 * origin so a fresh install works immediately, and let the dashboard nudge the owner
 * to add domains before sharing the snippet publicly.
 */
export function isOriginAllowed(origin: string | undefined, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return true;
  if (!origin) return false;

  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }

  return allowedDomains.some((pattern) => {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1); // ".example.com"
      return hostname.endsWith(suffix) || hostname === pattern.slice(2);
    }
    return hostname === pattern;
  });
}
