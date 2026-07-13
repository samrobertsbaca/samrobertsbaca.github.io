(function () {
  const STYLES = `
    .sp-player-container {
      --sp-theme: #00b4ff;
      --sp-bg: var(--sp-theme);
      --sp-bg-dark: color-mix(in srgb, var(--sp-theme), black 40%);
      --sp-border: color-mix(in srgb, var(--sp-theme), white 10%);
      --sp-text: #ffffff;
      --sp-sub: color-mix(in srgb, var(--sp-text), transparent 40%);
      --sp-accent: #ffffff;
      --sp-fill: #ffffff;
      --sp-radius: 10px;
      --sp-size: 96px;

      max-width: 580px;
      width: 100%;
      margin: 10px auto 30px auto;
      background: var(--sp-bg);
      //border: 0px solid var(--sp-border);
      border-radius: var(--sp-radius);
      overflow: hidden;
      display: grid;
      grid-template-columns: var(--sp-size) 1fr;
      grid-template-rows: var(--sp-size) auto; /* Strictly lock first row to art height */
      align-items: start; /* Force everything to stay at the top */
      font-family: 'BodyFont', monospace;
      box-sizing: border-box;
    }

    .sp-art {
      grid-column: 1;
      grid-row: 1;
      width: var(--sp-size) !important;
      height: var(--sp-size) !important;
      background: var(--sp-bg-dark);
      position: relative;
      overflow: hidden;
      display: block;
    }

    .sp-art img {
      position: absolute;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      display: block !important;
      margin: 0 !important;
    }

    .sp-main-content {
      grid-column: 2;
      grid-row: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      height: var(--sp-size); /* Match art height exactly */
    }

    .sp-header {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 0 22px;
      gap: 6px;
      box-sizing: border-box;
    }

    .sp-meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
    }

    .sp-meta {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
      overflow: hidden;
      flex: 1;
    }

    .sp-title {
      font-size: 15px;
      color: var(--sp-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sp-artist {
      font-size: 12px;
      font-style: italic;
      color: var(--sp-sub);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sp-lyric-toggle {
      background: transparent;
      border: none;
      color: var(--sp-sub);
      font-size: 8px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      padding: 0;
      margin-left: 15px;
      transition: color 0.2s;
    }
    .sp-lyric-toggle:hover { color: var(--sp-accent); }

    .sp-controls { display: flex; align-items: center; gap: 14px; margin-top: 4px;}
    .sp-play-btn { flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid var(--sp-accent); background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;}
    .sp-play-btn svg { width: 12px; height: 12px; fill: var(--sp-fill); }

    .sp-play-btn .sp-icon-pause { display: none; }
    .is-playing .sp-play-btn .sp-icon-play { display: none; }
    .is-playing .sp-play-btn .sp-icon-pause { display: block; }

    .sp-progress-wrap { flex: 1; min-width: 0; }
    .sp-progress-track { position: relative; height: 2px; background: var(--sp-bg-dark); cursor: pointer; margin-bottom: 5px; }
    .sp-progress-fill { position: absolute; left: 0; top: 0; height: 100%; width: 0%; background: var(--sp-fill); }
    .sp-time { display: flex; justify-content: space-between; font-size: 9px; color: var(--sp-sub); }

    .sp-lyrics-panel {
      grid-column: 1 / span 2;
      grid-row: 2; /* Ensure it stays in the second row */
      background: var(--sp-bg-dark);
      max-height: 0;
      overflow: hidden;
      padding: 0 22px;
      border-top: 0px solid transparent;
      transition: max-height 0.4s ease, padding 0.4s ease, border-top 0.4s ease;
    }

    .lyric-open .sp-lyrics-panel {
      max-height: 350px;
      padding: 24px 22px;
      border-top: 1px solid var(--sp-border);
      overflow-y: auto;
    }

    .sp-lyrics-content {
      color: color-mix(in srgb, var(--sp-text), transparent 15%);
      font-size: 15px;
      line-height: 1.6;
    }

    .sp-lyrics-content p { margin: 0 0 18px 0; }
    .sp-lyrics-content p:last-child { margin-bottom: 0; }

    .sp-lyrics-panel::-webkit-scrollbar { width: 4px; }
    .sp-lyrics-panel::-webkit-scrollbar-thumb { background: var(--sp-border); border-radius: 10px; }

    /* Shrink structural elements cleanly on narrow viewports */
    @media (max-width: 480px) {
      .sp-player-container {
        --sp-size: 96px; /* Shrinks album art from 96px */
      }
      .sp-header {
        padding: 0 12px; /* Drops padding from 22px to save 20px of width */
      }
      .sp-controls {
        gap: 8px; /* Tightens space between play button and timeline */
      }
      .sp-lyric-toggle {
        margin-left: 6px; /* Prevents button from pushing text out of view */
        letter-spacing: 0.5px; /* Saves a tiny bit more horizontal space */
      }
      .sp-title {
        font-size: 13px; /* Slightly smaller font to prevent aggressive ellipsis */
      }

      .sp-lyrics-panel {
        grid-column: 1 / span 2;
        grid-row: 2; /* Ensure it stays in the second row */
        background: var(--sp-bg-dark);
        max-height: 0;
        overflow: hidden;
        padding: 0 22px;
        border-top: 0px solid transparent;
        transition: max-height 0.4s ease, padding 0.4s ease, border-top 0.4s ease;
      }

      .lyric-open .sp-lyrics-panel {
        max-height: 222px !important;
        padding: 24px 22px;
        border-top: 1px solid var(--sp-border);
        overflow-y: auto;
      }

      .sp-lyrics-content {
        color: color-mix(in srgb, var(--sp-text), transparent 15%);
        font-size: 13px;
        line-height: 1.2;
      }

    }

  `;

  function injectStyles() {
    if (document.getElementById('sp-styles')) return;
    const style = document.createElement('style');
    style.id = 'sp-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function formatTime(s) {
    if (isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function buildPlayer(el) {
    const data = el.dataset;
    const audio = new Audio(data.src || '');
    const container = document.createElement('div');
    container.className = 'sp-player-container';

    if(data.theme) container.style.setProperty('--sp-theme', data.theme);

    const artHtml = data.art ? `<div class="sp-art"><img src="${data.art}" alt=""></div>` : `<div class="sp-art"></div>`;

    container.innerHTML = `
      ${artHtml}
      <div class="sp-main-content">
        <div class="sp-header">
          <div class="sp-meta-row">
            <div class="sp-meta">
              <div class="sp-title">${data.title || 'Untitled'}</div>
              <div class="sp-artist">${data.artist || ''}</div>
            </div>
            ${data.lyrics ? `<button class="sp-lyric-toggle">Lyrics</button>` : ''}
          </div>
          <div class="sp-controls">
            <button class="sp-play-btn">
              <svg class="sp-icon-play" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
              <svg class="sp-icon-pause" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            </button>
            <div class="sp-progress-wrap">
              <div class="sp-progress-track"><div class="sp-progress-fill"></div></div>
              <div class="sp-time"><span class="sp-current">0:00</span><span class="sp-duration">0:00</span></div>
            </div>
          </div>
        </div>
      </div>
      ${data.lyrics ? `<div class="sp-lyrics-panel"><div class="sp-lyrics-content">${data.lyrics}</div></div>` : ''}
    `;

    el.parentNode.insertBefore(container, el);
    el.remove();

    const playBtn = container.querySelector('.sp-play-btn');
    const toggleBtn = container.querySelector('.sp-lyric-toggle');
    const progressTrack = container.querySelector('.sp-progress-track');
    const progressFill = container.querySelector('.sp-progress-fill');
    const currentEl = container.querySelector('.sp-current');
    const durationEl = container.querySelector('.sp-duration');

    if (toggleBtn) {
      toggleBtn.onclick = () => {
        container.classList.toggle('lyric-open');
        toggleBtn.textContent = container.classList.contains('lyric-open') ? 'Close' : 'Lyrics';
      };
    }

    playBtn.onclick = () => {
      if (audio.paused) {
        document.querySelectorAll('.sp-player-container.is-playing').forEach(p => {
          if (p._spAudio) { p._spAudio.pause(); p.classList.remove('is-playing'); }
        });
        audio.play();
        container.classList.add('is-playing');
      } else {
        audio.pause();
        container.classList.remove('is-playing');
      }
    };

    audio.onended = () => {
      container.classList.remove('is-playing');
      progressFill.style.width = '0%';
      currentEl.textContent = '0:00';
    };

    audio.ontimeupdate = () => {
      const pct = (audio.currentTime / audio.duration) * 100 || 0;
      progressFill.style.width = pct + '%';
      currentEl.textContent = formatTime(audio.currentTime);
    };

    audio.onloadedmetadata = () => durationEl.textContent = formatTime(audio.duration);

    progressTrack.onclick = (e) => {
      const rect = progressTrack.getBoundingClientRect();
      audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
    };

    container._spAudio = audio;
  }

  function initPlayers() {
    injectStyles();
    document.querySelectorAll('[data-audio-player]').forEach(buildPlayer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlayers);
  } else {
    initPlayers();
  }
})();
