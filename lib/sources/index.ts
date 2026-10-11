// The source registry. Per-VC sources run in this order; batch sources once per run.
import type { SignalSource } from "../types";
import { batchFeedSource } from "./batch-feeds";
import { exaSource } from "./exa";
import { linkedinIndexSource } from "./linkedin-index";
import { newsRssSource } from "./news-rss";
import { podcastIndexSource } from "./podcast-index";
import { rssFeedSource } from "./rss-feed";
import { secFormDSource } from "./sec-form-d";
import { youtubeSource } from "./youtube";

export const PER_VC_SOURCES: SignalSource[] = [
  rssFeedSource,
  newsRssSource,
  exaSource,
  linkedinIndexSource,
  podcastIndexSource,
  youtubeSource,
  secFormDSource,
];

export const BATCH_SOURCES: SignalSource[] = [batchFeedSource];
