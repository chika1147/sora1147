const manifestUrl = './beta/x86_64/manifest.json';
const els = {
  statusTitle: document.getElementById('statusTitle'),
  statusMessage: document.getElementById('statusMessage'),
  statusBadge: document.getElementById('statusBadge'),
  versionValue: document.getElementById('versionValue'),
  buildValue: document.getElementById('buildValue'),
  archValue: document.getElementById('archValue'),
  sizeValue: document.getElementById('sizeValue'),
  channelPill: document.getElementById('channelPill'),
  serverChannel: document.getElementById('serverChannel'),
  shaValue: document.getElementById('shaValue'),
  downloadButton: document.getElementById('downloadButton'),
  serverLight: document.getElementById('serverLight'),
  serverStatus: document.getElementById('serverStatus'),
  sidebarDot: document.getElementById('sidebarDot'),
  sidebarStatus: document.getElementById('sidebarStatus'),
  lastChecked: document.getElementById('lastChecked'),
  checkButton: document.getElementById('checkButton'),
  copyShaButton: document.getElementById('copyShaButton'),
  themeButton: document.getElementById('themeButton')
};

function formatBytes(bytes) {
  if (!Number.isFinite(Number(bytes))) return '—';
  const value = Number(bytes);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function setServerOnline(online) {
  const className = online ? 'online' : 'offline';
  els.serverLight.className = `server-light ${className}`;
  els.sidebarDot.className = `server-dot ${className}`;
  els.serverStatus.textContent = online ? 'Online' : 'Unavailable';
  els.sidebarStatus.textContent = online ? 'Update Server Online' : 'Update Server Offline';
  els.statusBadge.className = online ? 'status-badge online-badge' : 'status-badge';
  els.statusBadge.innerHTML = online ? '<span class="pulse"></span> Online' : '<span class="pulse"></span> Offline';
}

async function loadManifest() {
  els.checkButton.disabled = true;
  els.checkButton.textContent = '確認中…';
  els.statusTitle.textContent = '更新情報を確認しています…';
  els.statusMessage.textContent = '公開Update Serverからmanifestを取得しています。';

  try {
    const response = await fetch(`${manifestUrl}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    els.versionValue.textContent = `v${data.latest_version ?? '—'}`;
    els.buildValue.textContent = data.build ?? '—';
    els.archValue.textContent = data.architecture ?? '—';
    els.sizeValue.textContent = formatBytes(data.size);
    els.channelPill.textContent = data.channel ?? '—';
    els.serverChannel.textContent = data.channel ?? '—';
    els.shaValue.textContent = data.package_sha256 ?? '—';
    els.lastChecked.textContent = new Date().toLocaleString('ja-JP');

    if (data.download_url) {
      els.downloadButton.href = data.download_url;
      els.downloadButton.classList.remove('disabled');
      els.downloadButton.removeAttribute('aria-disabled');
    }

    els.statusTitle.textContent = `ZeroNT OS v${data.latest_version} が利用できます`;
    els.statusMessage.textContent = `Build ${data.build} • ${data.architecture} • ${formatBytes(data.size)}。ダウンロード後、ZeroNT本体がSHA-256とEd25519署名を検証します。`;
    setServerOnline(true);
  } catch (error) {
    console.error(error);
    els.statusTitle.textContent = 'Update Serverに接続できませんでした';
    els.statusMessage.textContent = 'しばらくしてから「更新を確認」をもう一度押してください。';
    els.lastChecked.textContent = new Date().toLocaleString('ja-JP');
    setServerOnline(false);
  } finally {
    els.checkButton.disabled = false;
    els.checkButton.textContent = '更新を確認';
  }
}

els.checkButton.addEventListener('click', loadManifest);

els.copyShaButton.addEventListener('click', async () => {
  const value = els.shaValue.textContent.trim();
  if (!value || value === '—') return;
  try {
    await navigator.clipboard.writeText(value);
    els.copyShaButton.textContent = 'Copied';
    setTimeout(() => (els.copyShaButton.textContent = 'Copy'), 1200);
  } catch {
    els.copyShaButton.textContent = 'Copy failed';
  }
});

let theme = 'auto';
els.themeButton.addEventListener('click', () => {
  document.body.classList.remove('force-light', 'force-dark');
  if (theme === 'auto') {
    theme = 'dark';
    document.body.classList.add('force-dark');
    els.themeButton.textContent = '☀';
  } else if (theme === 'dark') {
    theme = 'light';
    document.body.classList.add('force-light');
    els.themeButton.textContent = '◐';
  } else {
    theme = 'auto';
    els.themeButton.textContent = '◐';
  }
});

loadManifest();
