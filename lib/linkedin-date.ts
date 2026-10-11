// LinkedIn activity IDs encode creation time in their first 41 bits
// (docs/signal-sources.md §1.6). Unofficial; callers fall back if null.

export function linkedinActivityDate(activityId: string, now = new Date()): Date | null {
  try {
    const bits = BigInt(activityId).toString(2);
    if (bits.length < 42) return null;
    const ms = parseInt(bits.slice(0, 41), 2);
    const d = new Date(ms);
    return d.getUTCFullYear() > 2010 && d <= now ? d : null;
  } catch {
    return null;
  }
}

/** Pull the activity id out of a linkedin.com/posts/... or /feed/update/urn:li:activity:... URL. */
export function linkedinActivityId(url: string): string | null {
  const m = url.match(/activity[-:](\d{15,20})/);
  return m ? m[1]! : null;
}

export function linkedinUrlDate(url: string, now = new Date()): Date | null {
  if (!/linkedin\.com/.test(url)) return null;
  const id = linkedinActivityId(url);
  return id ? linkedinActivityDate(id, now) : null;
}
