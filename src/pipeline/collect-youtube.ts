import Parser from "rss-parser";
import { YOUTUBE_CHANNELS, type YouTubeFeedSource } from "../config/youtube-channels";
import type { CollectedItem } from "./collect";

const YOUTUBE_CHANNEL_RSS = "https://www.youtube.com/feeds/videos.xml?channel_id=";
const YOUTUBE_PLAYLIST_RSS = "https://www.youtube.com/feeds/videos.xml?playlist_id=";
const MAX_ITEMS_PER_FEED = 5;

function buildFeedUrl(source: YouTubeFeedSource): string | null {
  if (source.channelId) return `${YOUTUBE_CHANNEL_RSS}${source.channelId}`;
  if (source.playlistId) return `${YOUTUBE_PLAYLIST_RSS}${source.playlistId}`;
  return null;
}

/**
 * Collect videos from configured YouTube channels/playlists via RSS (Atom feed).
 * Returns CollectedItem[] compatible with the existing pipeline.
 */
export async function collectYouTube(): Promise<CollectedItem[]> {
  const parser = new Parser({
    timeout: 10000,
    headers: {
      "User-Agent": "AI-AppPro-ContentPipeline/2.0",
    },
  });

  const allItems: CollectedItem[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const feed of YOUTUBE_CHANNELS) {
    const feedUrl = buildFeedUrl(feed);
    if (!feedUrl) {
      console.warn(`[collect-youtube] ${feed.name}: no channelId or playlistId, skipping`);
      failCount++;
      continue;
    }

    try {
      console.log(`[collect-youtube] Fetching: ${feed.name} (${feed.lang}, ${feed.grade})...`);
      const result = await parser.parseURL(feedUrl);

      const items: CollectedItem[] = (result.items || []).slice(0, MAX_ITEMS_PER_FEED).map((item) => ({
        title: item.title || "Untitled",
        url: item.link || "",
        source: `YouTube: ${feed.name}`,
        lang: feed.lang,
        grade: feed.grade,
        category: feed.category,
        summary: item.contentSnippet?.slice(0, 500) || null,
        content_snippet: null,
        published_at: item.pubDate ? new Date(item.pubDate) : null,
      }));

      allItems.push(...items);
      successCount++;
      console.log(`[collect-youtube]   ${feed.name}: ${items.length} items`);
    } catch (err) {
      failCount++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[collect-youtube]   ${feed.name}: FAILED — ${msg}`);
    }
  }

  console.log(
    `[collect-youtube] Summary: ${successCount}/${YOUTUBE_CHANNELS.length} channels OK, ` +
    `${failCount} failed, ${allItems.length} items collected`
  );
  return allItems;
}

// CLI entry point
if (process.argv[1]?.includes("collect-youtube")) {
  (async () => {
    const items = await collectYouTube();

    const bySource = new Map<string, number>();
    for (const item of items) {
      bySource.set(item.source, (bySource.get(item.source) || 0) + 1);
    }
    console.log("\n--- YouTube Source Breakdown ---");
    for (const [source, count] of bySource) {
      console.log(`  ${source}: ${count}`);
    }
    console.log(`\n[collect-youtube] Done. ${items.length} total items.`);
  })();
}
