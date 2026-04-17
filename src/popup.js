let allEntries = [];
let currentFilter = 'all';
let currentSearch = '';

const grid = document.getElementById('grid');
const stats = document.getElementById('stats');
const searchInput = document.getElementById('searchInput');
const pills = document.querySelectorAll('.pill');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');

function safeHttpUrl(url) {
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '';
  } catch {
    return '';
  }
}

function matchesSearch(entry, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  if (entry.title?.toLowerCase().includes(q)) return true;
  if (entry.channelName?.toLowerCase().includes(q)) return true;
  if (entry.channelHandle?.toLowerCase().includes(q)) return true;
  return false;
}

function matchesFilter(entry, filter) {
  if (filter === 'all') return true;
  if (filter === 'shorts') return entry.kind === 'short';
  return entry.source === filter;
}

function createEmptyState() {
  const wrap = document.createElement('div');
  wrap.className = 'empty';
  const isTrulyEmpty = allEntries.length === 0;
  const h2 = document.createElement('h2');
  h2.textContent = isTrulyEmpty ? 'No history yet' : 'Nothing matches';
  const p = document.createElement('p');
  p.textContent = isTrulyEmpty
    ? 'Browse YouTube and videos will appear here automatically.'
    : 'Try a different search or filter.';
  wrap.append(h2, p);
  return wrap;
}

function sourceLabel(source) {
  const map = {
    home: 'home',
    search: 'search',
    channel: 'channel',
    'watch-next': 'next',
    shorts: 'short',
    subscriptions: 'subs'
  };
  return map[source] || '';
}

function createGridItem(entry) {
  const link = document.createElement('a');
  link.className = 'grid-item' + (entry.kind === 'short' ? ' short' : '');
  const safeUrl = safeHttpUrl(entry.url);
  if (safeUrl) {
    link.href = safeUrl;
    link.target = '_blank';
    link.rel = 'noopener';
  }
  link.dataset.id = entry.videoId;

  const safeThumb = safeHttpUrl(entry.thumbnailUrl);
  if (safeThumb) {
    const img = document.createElement('img');
    img.src = safeThumb;
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    link.appendChild(img);
  }

  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const top = document.createElement('div');
  top.className = 'overlay-top';
  const source = document.createElement('span');
  source.className = 'source-badge';
  source.textContent = sourceLabel(entry.source);
  if (!source.textContent) source.style.display = 'none';
  const duration = document.createElement('span');
  duration.className = 'duration-badge';
  duration.textContent = entry.durationText || '';
  if (!duration.textContent) duration.style.display = 'none';
  const del = document.createElement('button');
  del.className = 'delete-btn';
  del.type = 'button';
  del.title = 'Remove';
  del.textContent = '\u2715';
  del.dataset.del = entry.videoId;
  // Put badges on left, delete on right
  const leftBadges = document.createElement('div');
  leftBadges.style.display = 'flex';
  leftBadges.style.gap = '4px';
  leftBadges.append(source, duration);
  top.append(leftBadges, del);

  const bottom = document.createElement('div');
  bottom.className = 'overlay-bottom';
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = entry.title || '';
  bottom.appendChild(title);
  if (entry.channelName) {
    const channel = document.createElement('div');
    channel.className = 'channel';
    channel.textContent = entry.channelName;
    bottom.appendChild(channel);
  }

  overlay.append(top, bottom);
  link.appendChild(overlay);
  return link;
}

function render() {
  const filtered = allEntries.filter(e => matchesFilter(e, currentFilter) && matchesSearch(e, currentSearch));
  const suffix = filtered.length !== allEntries.length ? ` of ${allEntries.length}` : '';
  stats.textContent = `${filtered.length}${suffix} items`;

  grid.textContent = '';
  if (filtered.length === 0) {
    grid.appendChild(createEmptyState());
    return;
  }

  const frag = document.createDocumentFragment();
  for (const entry of filtered) frag.appendChild(createGridItem(entry));
  grid.appendChild(frag);

  grid.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = btn.getAttribute('data-del');
      await chrome.runtime.sendMessage({ type: 'youtube-view-history:delete', videoId: id });
      allEntries = allEntries.filter(e => e.videoId !== id);
      render();
    });
  });
}

async function load() {
  const res = await chrome.runtime.sendMessage({ type: 'youtube-view-history:get' });
  allEntries = res?.history || [];
  render();
}

searchInput.addEventListener('input', (e) => {
  currentSearch = e.target.value;
  render();
});

pills.forEach(p => p.addEventListener('click', () => {
  pills.forEach(x => x.classList.remove('active'));
  p.classList.add('active');
  currentFilter = p.getAttribute('data-filter');
  render();
}));

exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(allEntries, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `youtube-view-history-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

clearBtn.addEventListener('click', async () => {
  if (!confirm('Clear all YouTube watch history? This cannot be undone.')) return;
  await chrome.runtime.sendMessage({ type: 'youtube-view-history:clear' });
  allEntries = [];
  render();
});

load();
