// the little scorsby in the browser tab: now and then it winks at you, and while you're away it falls asleep
(function () {
  if (window.__tabFace) return; window.__tabFace = true;
  const link = document.querySelector('link[rel~="icon"]');
  if (!link) return;
  const home = link.href; let title = document.title;
  const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const DARK = '#05060a', BLUE = '#3fb6ff';

  // the same face as the favicon: blue, round ears, big eyes, a red nose, a smile
  function face(eyes) {
    c.clearRect(0, 0, S, S);
    const dot = (x, y, r, col) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = col; c.fill(); };
    dot(15, 15, 14, DARK); dot(49, 15, 14, DARK); dot(32, 36, 28.5, DARK);
    dot(15, 15, 9, BLUE); dot(49, 15, 9, BLUE); dot(32, 36, 23, BLUE);
    c.lineCap = 'round'; c.lineWidth = 3.4; c.strokeStyle = DARK;
    const shut = (x) => { c.beginPath(); c.arc(x, 30, 5.2, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); };
    const open = (x) => { dot(x, 31, 7.6, '#fff'); dot(x + 0.6, 31.5, 3.6, DARK); };
    eyes[0] ? open(23) : shut(23);
    eyes[1] ? open(41) : shut(41);
    dot(32, 40, 4.2, '#ed1c24');
    c.beginPath(); c.arc(32, 45.5, 6.5, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    return cv.toDataURL('image/png');
  }
  const WINK = face([true, false]);
  function asleep() {
    face([false, false]);
    // a little z, floating off one ear
    c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 4; c.strokeStyle = '#fff'; c.strokeText('z', 54, 48); c.fillStyle = DARK; c.fillText('z', 54, 48);
    return cv.toDataURL('image/png');
  }
  const SLEEP = asleep();
  const set = (href) => { link.type = 'image/png'; link.href = href; };
  const wake = () => { link.type = 'image/webp'; link.href = home; };

  let winkT = 0, backT = 0;
  function winkSoon() {
    clearTimeout(winkT);
    winkT = setTimeout(() => {
      if (!document.hidden) { set(WINK); setTimeout(() => { if (!document.hidden) wake(); }, 450); }
      winkSoon();
    }, 25000 + Math.random() * 35000);
  }
  document.addEventListener('visibilitychange', () => {
    clearTimeout(backT);
    if (document.hidden) { if (!/come back when|welcome back/.test(document.title)) title = document.title; set(SLEEP); document.title = 'come back when you’re ready'; return; }
    wake(); document.title = 'welcome back :-)';
    backT = setTimeout(() => { document.title = title; }, 2200);
  });
  winkSoon();
})();
