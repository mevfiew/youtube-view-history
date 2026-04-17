const MSG_TYPE = 'youtube-view-history:entries';

(function injectInterceptor() {
  const script = document.createElement('script');
  script.type = 'module';
  script.src = chrome.runtime.getURL('src/interceptor.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
})();

function extensionContextAlive() {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== MSG_TYPE) return;
  const entries = event.data.entries;
  if (!Array.isArray(entries) || entries.length === 0) return;
  // When the extension is reloaded or updated, this content script keeps
  // running in the old tab but its chrome.runtime handle becomes invalid.
  // chrome.runtime.sendMessage throws synchronously in that state, so a
  // promise .catch is not enough — we need a guard + try/catch.
  if (!extensionContextAlive()) return;
  try {
    const promise = chrome.runtime.sendMessage({ type: MSG_TYPE, entries });
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
  } catch {
    // Extension context invalidated; silently drop.
  }
});
