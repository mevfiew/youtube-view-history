import { parseFeedResponse, isFeedEndpoint, inferSourceFromUrl, inferSourceFromInitialData } from './lib/parser.js';

const MSG_TYPE = 'youtube-view-history:entries';

function report(entries) {
  if (!entries?.length) return;
  window.postMessage({ type: MSG_TYPE, entries }, '*');
}

function reportFromInitialData() {
  try {
    const data = window.ytInitialData;
    if (!data) return;
    const source = inferSourceFromInitialData(data);
    report(parseFeedResponse(data, source));
  } catch {}
}

function reportCurrentShortFromUrl() {
  try {
    const m = location.href.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (!m) return;
    const videoId = m[1];
    const title = document.title.replace(/\s*-\s*YouTube\s*$/, '').trim();
    if (!title) return;
    const entry = {
      videoId,
      kind: 'short',
      title,
      channelName: '',
      channelHandle: '',
      channelId: '',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      durationText: '',
      durationSec: 0,
      viewCountText: '',
      publishedText: '',
      url: `https://www.youtube.com/shorts/${videoId}`,
      source: 'shorts',
      viewedAt: Date.now()
    };
    window.postMessage({ type: MSG_TYPE, entries: [entry] }, '*');
  } catch {}
}

function reportCurrentPageVideo() {
  if (location.pathname.startsWith('/shorts/')) {
    reportCurrentShortFromUrl();
    return;
  }
  reportFromInitialData();
}

// Run once as soon as script executes (DOM-ready check).
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', reportCurrentPageVideo, { once: true });
} else {
  reportCurrentPageVideo();
}

// Re-scan on SPA navigation (YouTube swaps URL + ytInitialData without full reload).
let lastUrl = location.href;
const navTimer = setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    // Title update can lag the URL change slightly — give it a moment.
    setTimeout(reportCurrentPageVideo, 600);
  }
}, 500);

// Fetch hook for continuation / API-driven responses.
const originalFetch = window.fetch;
window.fetch = async function patchedFetch(...args) {
  const response = await originalFetch.apply(this, args);
  try {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    if (url && isFeedEndpoint(url)) {
      const source = inferSourceFromUrl(url);
      response.clone().json()
        .then(json => report(parseFeedResponse(json, source)))
        .catch(() => {});
    }
  } catch {}
  return response;
};
