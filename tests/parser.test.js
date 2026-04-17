import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import {
  parseFeedResponse,
  isFeedEndpoint,
  inferSourceFromUrl,
  inferSourceFromInitialData
} from '../src/lib/parser.js';

async function loadFixture(name) {
  return JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
}

test('parses search results (videoRenderer + shortsLockupViewModel)', async () => {
  const data = await loadFixture('search-results.json');
  const out = parseFeedResponse(data, 'search');
  assert.ok(out.length > 10, `expected >10 entries, got ${out.length}`);
  for (const v of out) {
    assert.ok(v.videoId.length === 11, `videoId should be 11 chars, got "${v.videoId}"`);
    assert.ok(v.url.startsWith('https://www.youtube.com/'));
    assert.ok(v.kind === 'video' || v.kind === 'short');
    assert.strictEqual(v.source, 'search');
  }
  const vids = out.filter(v => v.kind === 'video');
  const shorts = out.filter(v => v.kind === 'short');
  assert.ok(vids.length > 0, 'expected some videos');
  assert.ok(shorts.length > 0, 'expected some shorts');
});

test('parses channel page (gridVideoRenderer)', async () => {
  const data = await loadFixture('channel-page.json');
  const out = parseFeedResponse(data, 'channel');
  assert.ok(out.length > 50, `expected >50 channel entries, got ${out.length}`);
  for (const v of out) {
    assert.strictEqual(v.kind, 'video');
    assert.ok(v.title.length > 0, `title should not be empty for ${v.videoId}`);
    assert.ok(v.thumbnailUrl.startsWith('http'), `bad thumbnail for ${v.videoId}`);
  }
});

test('parses watch page (lockupViewModel + shortsLockupViewModel)', async () => {
  const data = await loadFixture('watch-page.json');
  const out = parseFeedResponse(data, 'watch-next');
  assert.ok(out.length > 15, `expected >15 entries, got ${out.length}`);
  const vids = out.filter(v => v.kind === 'video');
  const shorts = out.filter(v => v.kind === 'short');
  assert.ok(vids.length > 0);
  assert.ok(shorts.length > 0);
  for (const v of vids) {
    assert.ok(v.title.length > 0, `title should be non-empty: ${JSON.stringify(v)}`);
    assert.ok(v.channelName.length > 0, `channelName should be non-empty: ${JSON.stringify(v)}`);
  }
});

test('dedupes by videoId within a response', async () => {
  const data = await loadFixture('search-results.json');
  const out = parseFeedResponse(data, 'search');
  const ids = out.map(v => v.videoId);
  const unique = new Set(ids);
  assert.strictEqual(ids.length, unique.size, 'expected no duplicate videoIds within a single response');
});

test('isFeedEndpoint recognises youtubei paths', () => {
  assert.strictEqual(isFeedEndpoint('https://www.youtube.com/youtubei/v1/search?prettyPrint=false'), true);
  assert.strictEqual(isFeedEndpoint('https://www.youtube.com/youtubei/v1/browse'), true);
  assert.strictEqual(isFeedEndpoint('https://www.youtube.com/youtubei/v1/next'), true);
  assert.strictEqual(isFeedEndpoint('https://www.youtube.com/youtubei/v1/reel/reel_watch_sequence'), true);
  assert.strictEqual(isFeedEndpoint('https://www.youtube.com/youtubei/v1/player'), true);
});

test('isFeedEndpoint rejects non-feed endpoints', () => {
  assert.strictEqual(isFeedEndpoint('https://www.youtube.com/youtubei/v1/log_event'), false);
  assert.strictEqual(isFeedEndpoint('https://www.youtube.com/youtubei/v1/guide'), false);
  assert.strictEqual(isFeedEndpoint('https://example.com/youtubei/v1/search'), false);
  assert.strictEqual(isFeedEndpoint('not-a-url'), false);
});

test('inferSourceFromUrl maps known paths', () => {
  assert.strictEqual(inferSourceFromUrl('https://www.youtube.com/youtubei/v1/search?x=1'), 'search');
  assert.strictEqual(inferSourceFromUrl('https://www.youtube.com/youtubei/v1/next?x=1'), 'watch-next');
  assert.strictEqual(inferSourceFromUrl('https://www.youtube.com/youtubei/v1/reel'), 'shorts');
  assert.strictEqual(inferSourceFromUrl('https://www.youtube.com/youtubei/v1/browse'), 'home');
});

test('inferSourceFromInitialData identifies page types', async () => {
  const search = await loadFixture('search-results.json');
  assert.strictEqual(inferSourceFromInitialData(search), 'search');

  const watch = await loadFixture('watch-page.json');
  assert.strictEqual(inferSourceFromInitialData(watch), 'watch-next');

  const channel = await loadFixture('channel-page.json');
  assert.strictEqual(inferSourceFromInitialData(channel), 'channel');
});

test('parseFeedResponse returns empty array for invalid input', () => {
  assert.deepStrictEqual(parseFeedResponse(null), []);
  assert.deepStrictEqual(parseFeedResponse({}), []);
  assert.deepStrictEqual(parseFeedResponse({ no: 'renderers' }), []);
});
