// the little scorsby in the browser tab: now and then it winks at you, and while you're away it falls asleep
(function () {
  if (window.__tabFace) return; window.__tabFace = true;
  const link = document.querySelector('link[rel~="icon"]');
  if (!link) return;
  const home = link.href; let title = document.title;
  // the winking and sleeping faces are the favicon itself, with only its eyes drawn over, so nothing else moves
  const DARK = '#000', BLUE = 'rgb(0,174,239)';
  const cv = document.createElement('canvas'), c = cv.getContext('2d');
  let WINK = null, SLEEP = null;
  const img = new Image();
  img.onload = () => {
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const k = cv.width / 100; // (measured on the 100-wide favicon: eyes at 35.5 and 63.5, 45 down, about 13.5 across)
    const face = (shut, z) => {
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.drawImage(img, 0, 0);
      c.setTransform(k, 0, 0, k, 0, 0);
      for (const ex of shut) {
        // the two eyes touch in the middle, so each is covered only on its own side of it
        c.save(); c.beginPath(); c.rect(ex < 49.5 ? 0 : 49.5, 0, 49.5 + (ex < 49.5 ? 0 : 50.5), 91); c.clip();
        c.beginPath(); c.arc(ex, 45, 16, 0, Math.PI * 2); c.fillStyle = BLUE; c.fill(); c.restore();
        c.beginPath(); c.arc(ex, 41.5, 9, 0.08 * Math.PI, 0.92 * Math.PI); c.lineWidth = 5.2; c.lineCap = 'round'; c.strokeStyle = DARK; c.stroke();
      }
      // (covering an eye reaches the top of the nose: put the favicon's own nose back)
      c.save(); c.beginPath(); c.arc(49.5, 57, 7.6, 0, Math.PI * 2); c.clip(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(img, 0, 0); c.restore();
      c.setTransform(k, 0, 0, k, 0, 0);
      for (const ex of shut) { c.beginPath(); c.arc(ex, 41.5, 9, 0.08 * Math.PI, 0.92 * Math.PI); c.lineWidth = 5.2; c.lineCap = 'round'; c.strokeStyle = DARK; c.stroke(); }
      if (z) {
        // a little z, floating off by its cheek
        c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = 6; c.lineJoin = 'round'; c.strokeStyle = '#fff'; c.strokeText('z', 86, 74); c.fillStyle = DARK; c.fillText('z', 86, 74);
      }
      return cv.toDataURL('image/png');
    };
    WINK = face([63.5]); SLEEP = face([35.5, 63.5], true);
  };
  img.src = home;
  const set = (href) => { link.type = 'image/png'; link.href = href; };
  const wake = () => { link.type = 'image/webp'; link.href = home; };

  let winkT = 0, backT = 0;
  function winkSoon() {
    clearTimeout(winkT);
    winkT = setTimeout(() => {
      if (!document.hidden && WINK) { set(WINK); setTimeout(() => { if (!document.hidden) wake(); }, 450); }
      winkSoon();
    }, 25000 + Math.random() * 35000);
  }
  document.addEventListener('visibilitychange', () => {
    clearTimeout(backT);
    if (document.hidden) { if (!/scorsby is sleeping|welcome back/.test(document.title)) title = document.title; if (SLEEP) set(SLEEP); document.title = 'scorsby is sleeping...'; return; }
    wake(); document.title = 'welcome back :-)';
    backT = setTimeout(() => { document.title = title; }, 2200);
  });
  winkSoon();
})();
