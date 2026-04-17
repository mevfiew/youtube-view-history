// YouTube ytInitialData / youtubei feed response parser.
// Handles three shapes observed in the wild as of 2026-04-17:
//   - videoRenderer       : search, some home feed items
//   - gridVideoRenderer   : channel pages
//   - lockupViewModel     : watch-next sidebar (replaces the older compactVideoRenderer)
//   - shortsLockupViewModel : Shorts shelves everywhere
//
// The parser walks the ytInitialData tree, collects any renderer it recognizes,
// and normalizes each to the unified Video shape.

const FEED_PATH_PATTERNS = [
  /^\/youtubei\/v1\/browse\b/,
  /^\/youtubei\/v1\/search\b/,
  /^\/youtubei\/v1\/next\b/,
  /^\/youtubei\/v1\/reel\b/,
  /^\/youtubei\/v1\/player\b/
];

export function isFeedEndpoint(urlString) {
  try {
    const u = new URL(urlString);
    if (!/(^|\.)youtube\.com$/.test(u.hostname)) return false;
    return FEED_PATH_PATTERNS.some(rx => rx.test(u.pathname));
  } catch {
    return false;
  }
}

function getText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value.simpleText) return String(value.simpleText);
  if (Array.isArray(value.runs)) return value.runs.map(r => r?.text || '').join('');
  if (value.content) return String(value.content);
  return '';
}

function getThumbnailFromList(thumbObj) {
  if (!thumbObj) return '';
  const list = thumbObj.thumbnails || (thumbObj.image && thumbObj.image.sources) || [];
  if (!Array.isArray(list) || list.length === 0) return '';
  const largest = list[list.length - 1];
  return String(largest?.url || '');
}

function parseDurationTextToSeconds(text) {
  if (!text) return 0;
  const parts = String(text).trim().split(':').map(p => parseInt(p, 10));
  if (parts.some(p => !Number.isFinite(p))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

function extractFromVideoRenderer(node) {
  const videoId = String(node.videoId || '');
  if (!videoId) return null;
  const durationText = getText(node.lengthText) || getText(node.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer?.text);
  return {
    videoId,
    kind: 'video',
    title: getText(node.title),
    channelName: getText(node.ownerText) || getText(node.longBylineText) || getText(node.shortBylineText),
    channelHandle: '',
    channelId: node.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '',
    thumbnailUrl: getThumbnailFromList(node.thumbnail),
    durationText,
    durationSec: parseDurationTextToSeconds(durationText),
    viewCountText: getText(node.viewCountText) || getText(node.shortViewCountText),
    publishedText: getText(node.publishedTimeText)
  };
}

function extractFromGridVideoRenderer(node) {
  const videoId = String(node.videoId || '');
  if (!videoId) return null;
  const durationText = getText(node.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer?.text);
  return {
    videoId,
    kind: 'video',
    title: getText(node.title),
    channelName: getText(node.shortBylineText) || getText(node.longBylineText),
    channelHandle: '',
    channelId: node.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '',
    thumbnailUrl: getThumbnailFromList(node.thumbnail),
    durationText,
    durationSec: parseDurationTextToSeconds(durationText),
    viewCountText: getText(node.viewCountText) || getText(node.shortViewCountText),
    publishedText: getText(node.publishedTimeText)
  };
}

function findOverlayDurationText(contentImage) {
  const overlays = contentImage?.thumbnailViewModel?.overlays;
  if (!Array.isArray(overlays)) return '';
  for (const o of overlays) {
    const badges = o?.thumbnailBottomOverlayViewModel?.badges;
    if (!Array.isArray(badges)) continue;
    for (const b of badges) {
      const text = b?.thumbnailBadgeViewModel?.text;
      if (text) return String(text);
    }
  }
  return '';
}

function extractFromLockupViewModel(node) {
  const videoId = String(node.contentId || '');
  if (!videoId) return null;
  // Only accept video content types
  if (node.contentType && node.contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO') return null;

  const meta = node.metadata?.lockupMetadataViewModel;
  const title = getText(meta?.title);
  const rows = meta?.metadata?.contentMetadataViewModel?.metadataRows || [];
  const channelName = getText(rows[0]?.metadataParts?.[0]?.text);
  const viewCountText = getText(rows[1]?.metadataParts?.[0]?.text);
  const publishedText = getText(rows[1]?.metadataParts?.[1]?.text);
  const durationText = findOverlayDurationText(node.contentImage);

  return {
    videoId,
    kind: 'video',
    title,
    channelName,
    channelHandle: '',
    channelId: '',
    thumbnailUrl: getThumbnailFromList(node.contentImage?.thumbnailViewModel),
    durationText,
    durationSec: parseDurationTextToSeconds(durationText),
    viewCountText,
    publishedText
  };
}

function extractFromShortsLockupViewModel(node) {
  const videoId = String(node.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId || '')
    || (String(node.entityId || '').split('-').pop() || '');
  if (!videoId || videoId.length !== 11) return null;
  const title = String(node.overlayMetadata?.primaryText?.content || '')
    || String(node.accessibilityText || '').split(/,|–/)[0].trim();
  const viewCountText = String(node.overlayMetadata?.secondaryText?.content || '');
  return {
    videoId,
    kind: 'short',
    title,
    channelName: '',
    channelHandle: '',
    channelId: '',
    thumbnailUrl: getThumbnailFromList(node.thumbnailViewModel),
    durationText: '',
    durationSec: 0,
    viewCountText,
    publishedText: ''
  };
}

function walk(node, out, seen, depth = 0) {
  if (!node || depth > 60) return;
  if (typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const child of node) walk(child, out, seen, depth + 1);
    return;
  }

  for (const key of Object.keys(node)) {
    const value = node[key];
    let extracted = null;
    if (key === 'videoRenderer') extracted = extractFromVideoRenderer(value);
    else if (key === 'gridVideoRenderer') extracted = extractFromGridVideoRenderer(value);
    else if (key === 'lockupViewModel') extracted = extractFromLockupViewModel(value);
    else if (key === 'shortsLockupViewModel') extracted = extractFromShortsLockupViewModel(value);

    if (extracted && !seen.has(extracted.videoId)) {
      seen.add(extracted.videoId);
      out.push(extracted);
    } else if (value && typeof value === 'object') {
      walk(value, out, seen, depth + 1);
    }
  }
}

function buildUrl(v) {
  return v.kind === 'short'
    ? `https://www.youtube.com/shorts/${v.videoId}`
    : `https://www.youtube.com/watch?v=${v.videoId}`;
}

export function parseFeedResponse(json, source = 'unknown') {
  const out = [];
  const seen = new Set();
  walk(json, out, seen);
  const now = Date.now();
  return out.map(v => ({
    ...v,
    url: buildUrl(v),
    source,
    viewedAt: now
  }));
}

// Source inference from a request URL (best-effort).
export function inferSourceFromUrl(urlString) {
  try {
    const u = new URL(urlString);
    if (u.pathname.includes('/search')) return 'search';
    if (u.pathname.includes('/next')) return 'watch-next';
    if (u.pathname.includes('/reel')) return 'shorts';
    if (u.pathname.includes('/browse')) {
      // /browse is ambiguous (home, subs, channel) — decide by body browseId if available
      return 'home';
    }
  } catch {}
  return 'unknown';
}

// Source inference from ytInitialData page context.
export function inferSourceFromInitialData(data) {
  if (!data) return 'unknown';
  const url = data?.currentVideoEndpoint?.watchEndpoint?.videoId
    ? 'watch-next'
    : null;
  if (url) return url;
  const browseId = data?.responseContext?.serviceTrackingParams?.[0]?.params?.find?.(p => p.key === 'browse_id')?.value;
  if (browseId === 'FEwhat_to_watch') return 'home';
  if (browseId === 'FEsubscriptions') return 'subscriptions';
  if (data?.contents?.twoColumnSearchResultsRenderer) return 'search';
  if (data?.contents?.twoColumnBrowseResultsRenderer?.tabs) return 'channel';
  if (data?.contents?.twoColumnWatchNextResults) return 'watch-next';
  return 'unknown';
}
