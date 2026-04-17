# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-04-17

### Added
- Automatic capture of YouTube videos as they appear in your feed, search results, channel pages, watch-next sidebar, and Shorts shelves on `youtube.com`.
- Source tagging per video: home / search / channel / watch-next / subscriptions / shorts.
- Local storage via `chrome.storage.local` (up to 10 000 items, oldest pruned first).
- Popup UI: 3-column 16:9 grid with Shorts rendered as 9:16, source-filter pills, search by title and channel, delete, clear, JSON export.
- Source tagging via `window.ytInitialData` inference on page load and URL-based inference for continuation fetches.
- Supports four renderer shapes observed in real YouTube responses: `videoRenderer`, `gridVideoRenderer`, `lockupViewModel` (new watch-next shape), and `shortsLockupViewModel`.
- MV3 manifest with zero outbound network requests and no remote code.

[1.0.0]: https://github.com/mevfiew/youtube-view-history/releases/tag/v1.0.0
