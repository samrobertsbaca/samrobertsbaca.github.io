// the little scorsby in the browser tab: now and then it winks at you, and while you're away it falls asleep
(function () {
  if (window.__tabFace) return; window.__tabFace = true;
  const link = document.querySelector('link[rel~="icon"]');
  if (!link) return;
  const home = link.href; let title = document.title;
  const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const DARK = '#000', BLUE = '#00b4ff', RED = '#ed1f24';

  // the favicon's own face, measured off the drawing (in its units, about 1900 across), then shrunk to fit the tab
  function face(left, right) {
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, S, S);
    const k = 62 / 1830; c.setTransform(k, 0, 0, k, 1 - 45 * k, 2.4 - 58 * k);
    const dot = (x, y, r, col) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = col; c.fill(); };
    // outlines first, then the blue on top, so the ears and the head are one shape
    dot(440, 450, 395, DARK); dot(1470, 450, 395, DARK); dot(955, 968, 738, DARK);
    dot(440, 450, 297, BLUE); dot(1470, 450, 297, BLUE); dot(955, 968, 641, BLUE);
    c.lineCap = 'round'; c.lineWidth = 96; c.strokeStyle = DARK;
    const smile = (x, y) => { c.beginPath(); c.arc(x, y, 172, 0, Math.PI); c.stroke(); };
    const eye = (x, open) => {
      if (!open) return smile(x, 842);
      dot(x, 845, 268, '#fff'); dot(x + 30, 852, 132, DARK); // (as big as the favicon's own eyes)
    };
    eye(672, left); eye(1244, right);
    dot(955, 1097, 124, RED);
    smile(955, 1268);
    c.setTransform(1, 0, 0, 1, 0, 0);
    return cv.toDataURL('image/png');
  }
  const WINK = face(true, false), SLEEP = face(false, false);
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
