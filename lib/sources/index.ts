// The source registry. Per-VC sources run in this order; batch sources once per run.
import type { SignalSource } from "../types";
import { batchFeedSource } from "./batch-feeds";
import { exaSource } from "./exa";
import { linkedinIndexSource } from "./linkedin-index";
import { podcastIndexSource } from "./podcast-index";
import { rssFeedSource } from "./rss-feed";
import { secFormDSource } from "./sec-form-d";
import { tavilySource } from "./tavily";
import { youtubeSource } from "./youtube";

export const PER_VC_SOURCES: SignalSource[] = [
  rssFeedSource,
  exaSource,
  linkedinIndexSource,
  podcastIndexSource,
  youtubeSource,
  secFormDSource,
  tavilySource, // fallbackOnly
];

export const BATCH_SOURCES: SignalSource[] = [batchFeedSource];
