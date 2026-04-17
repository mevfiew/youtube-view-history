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

// Run once as soon as script executes (DOM-ready check).
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', reportFromInitialData, { once: true });
} else {
  reportFromInitialData();
}

// Also re-scan on SPA navigation (YouTube swaps ytInitialData without reload).
let lastUrl = location.href;
const navTimer = setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(reportFromInitialData, 500);
  }
}, 1000);

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
