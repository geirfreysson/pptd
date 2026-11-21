// Update check: ask GitHub for the latest PPTD release and say when it is newer than this
// copy. Nothing is downloaded or installed: the banner's Download button opens the
// installer's link in the browser. The request carries no personal data, only the app's
// name and version in the User-Agent.

const { net } = require('electron');

const REPO = 'geirfreysson/pptd';
const RELEASES = `https://github.com/${REPO}/releases`;
const FEED = `https://api.github.com/repos/${REPO}/releases/latest`;

// "1.2.0" / "v1.2.0" -> [1, 2, 0]; null if it isn't a plain release version.
function parseVersion(s) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(s || '').trim());
  return m ? m.slice(1).map(Number) : null;
}

function isNewer(latest, current) {
  const a = parseVersion(latest), b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

// Only links into this repo's releases are ever opened.
const isReleaseUrl = (u) => typeof u === 'string' && u.startsWith(`${RELEASES}/`);

// The installer for this machine, by the stable names the release workflow uploads;
// otherwise (Linux, where there's a choice, or a platform without a build) the release page.
function downloadUrl(release, platform = process.platform, arch = process.arch) {
  const want = platform === 'darwin' && arch === 'arm64' ? `-mac-arm64.dmg`
    : platform === 'win32' && arch === 'x64' ? `-windows-x64-setup.exe`
    : null;
  const asset = want && (release.assets || []).find((a) => a?.name === `PPTD-${release.version}${want}`);
  const url = asset?.browser_download_url;
  return isReleaseUrl(url) ? url : release.page;
}

// Resolves to { version, page, download } for the latest release. Throws on network or
// format errors. PPTD_UPDATE_FEED overrides the feed URL (for testing).
async function fetchLatest(currentVersion) {
  const feed = process.env.PPTD_UPDATE_FEED || FEED;
  const res = await net.fetch(feed, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `PPTD/${currentVersion}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const json = await res.json();
  const version = String(json.tag_name || '').replace(/^v/, '');
  if (!parseVersion(version)) throw new Error('the latest release has no version');
  const page = isReleaseUrl(json.html_url) ? json.html_url : `${RELEASES}/latest`;
  const release = { version, page, assets: json.assets };
  return { version, page, download: downloadUrl(release) };
}

module.exports = { fetchLatest, isNewer, isReleaseUrl, parseVersion, downloadUrl, RELEASES };
