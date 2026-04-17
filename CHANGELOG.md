# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] — 2026-04-17

### Fixed
- Shorts thumbnails from home/search/watch-next now render correctly. Renderer-supplied `frame0.jpg` URLs are unsigned and fail to load from the extension origin; always use the stable `i.ytimg.com/vi/{id}/hqdefault.jpg` pattern instead.

### Changed
- Shorts and regular videos now live in separate views. `All` / `Home` / `Search` / `Channel` / `Watch-next` filters show only regular videos. `Shorts` pill shows only Shorts. No more mixed-format tiles in one grid.

## [1.0.2] — 2026-04-17

### Fixed
- Shorts watched inside the vertical Shorts player (`/shorts/{id}` URL) are now captured. v1.0.1 only captured Shorts when they appeared in feed/search/watch-next shelves via `shortsLockupViewModel`; the dedicated Shorts player uses a different data flow (`/youtubei/v1/reel/reel_item_watch`) that didn't ship the same renderer shapes.
- Fix: when SPA navigation moves to a `/shorts/{id}` URL, extract the videoId from the URL pattern, pull the title from `document.title`, and construct a thumbnail URL from `i.ytimg.com/vi/{id}/hqdefault.jpg`. Each swipe changes the URL, which triggers a fresh capture via the existing navigation poll.

## [1.0.1] — 2026-04-17

### Fixed
- Popup thumbnails now render. v1.0.0 set `referrerPolicy="no-referrer"` on the grid `<img>` tags, which stripped the Referer header. YouTube's `i.ytimg.com` CDN returns an error page for signed thumbnail URLs without a valid Referer. Removing the attribute restores thumbnail loading.

## [1.0.0] — 2026-04-17

### Added
- Automatic capture of YouTube videos as they appear in your feed, search results, channel pages, watch-next sidebar, and Shorts shelves on `youtube.com`.
- Source tagging per video: home / search / channel / watch-next / subscriptions / shorts.
- Local storage via `chrome.storage.local` (up to 10 000 items, oldest pruned first).
- Popup UI: 3-column 16:9 grid with Shorts rendered as 9:16, source-filter pills, search by title and channel, delete, clear, JSON export.
- Source tagging via `window.ytInitialData` inference on page load and URL-based inference for continuation fetches.
- Supports four renderer shapes observed in real YouTube responses: `videoRenderer`, `gridVideoRenderer`, `lockupViewModel` (new watch-next shape), and `shortsLockupViewModel`.
- MV3 manifest with zero outbound network requests and no remote code.

[1.0.3]: https://github.com/mevfiew/youtube-view-history/releases/tag/v1.0.3
[1.0.2]: https://github.com/mevfiew/youtube-view-history/releases/tag/v1.0.2
[1.0.1]: https://github.com/mevfiew/youtube-view-history/releases/tag/v1.0.1
[1.0.0]: https://github.com/mevfiew/youtube-view-history/releases/tag/v1.0.0
