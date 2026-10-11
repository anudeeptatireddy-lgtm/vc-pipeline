// Firm / partner blog, Substack or Medium feed (docs/signal-sources.md §2.2, §4.3).
import type { SignalSource } from "../types";
import { fetchFeed } from "./feeds";

export const rssFeedSource: SignalSource = {
  name: "firm-rss",
  enabled: (vc) => !!vc.rss_url,
  fetchForVc: (vc, since) => fetchFeed(vc.rss_url!, "firm-rss", "B", since),
};
