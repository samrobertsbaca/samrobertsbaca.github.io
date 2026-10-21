function createSitePet(gfx, opts = {}) {
  if (!gfx) gfx = 'sprite';

  const ANI = {
    IDEL1: 0, IDEL2: 1, IDEL3: 2,
    RIGHT: 3, DOWN: 4, LEFT: 5, UP: 6,
    PET: 7, SLEEP: 8
  };

  const ele = document.createElement("div");
  ele.style.position = 'fixed';
  ele.style.width = '64px';
  ele.style.height = '64px';
  ele.style.backgroundImage = `url(/js/site-pet/gfx/${gfx}.png)`;
  ele.style.backgroundRepeat = 'no-repeat';
  ele.style.backgroundPosition = '0px 0px';
  ele.style.imageRendering = 'pixelated';
  ele.style.zIndex = '0'; // behind the words, covers and buttons (in front of the plain page), so it never covers what you're reading
  document.body.appendChild(ele);

  const MaxFrame = 8;
  const tick = 150 + Math.random() * 100; // each one walks at its own pace
  let anim = 0, frame = 0, sleep = 0, hold = 0, moving = false;

  // Spawn off-screen
  const side = opts.side || (Math.random() < 0.5 ? 'left' : 'right');
  let y = Math.floor((opts.y ?? Math.random() * (window.innerHeight - 64)) / 64) * 64;
  let x = side === 'left' ? -64 : window.innerWidth;

  // where it is, and where it's walking to. each step glides there over the time its walk takes (8 frames),
  // drawn every animation frame, so it never jumps (and simply waits while the tab is hidden)
  const step = { fx: x, fy: y, at: 0, dur: 1 };
  const place = (px, py) => { ele.style.left = `${px}px`; ele.style.top = `${py}px`; };
  const here = (now = performance.now()) => {
    const k = Math.min(1, (now - step.at) / step.dur);
    return [step.fx + (x - step.fx) * k, step.fy + (y - step.fy) * k];
  };
  const glide = (now) => { place(...here(now)); requestAnimationFrame(glide); };
  place(x, y);
  requestAnimationFrame(glide);

  anim = side === 'left' ? ANI.RIGHT : ANI.LEFT;

  const setAnim = a => { frame = 0; anim = a; };
  const draw = () => { ele.style.backgroundPosition = `${-64 * frame}px ${-64 * anim}px`; };

  const update = () => {
    // the next step is chosen before drawing, so a new direction shows the moment it starts moving that way
    if (frame >= MaxFrame) {
      moving = false;
      if (anim === ANI.PET && hold < 4) { hold++; frame = MaxFrame - 1; } // the happy pose at the end lingers a moment
      else if (sleep > 0) {
        sleep--;
        setAnim(ANI.SLEEP);
      } else if (anim !== ANI.PET && anim !== ANI.SLEEP && Math.random() < 0.04) {
        // now and then, left to itself, it curls up for a little doze (about 10 to 25 seconds)
        sleep = 6 + Math.floor(Math.random() * 9);
        setAnim(ANI.SLEEP);
      } else {
        // Random movement after initial spawn
        let d = Math.floor(Math.random() * 4);
        let sx = 0, sy = 0, a;

        if (d === 0) { sx = 64; a = ANI.RIGHT; }
        else if (d === 1) { sx = -64; a = ANI.LEFT; }
        else if (d === 2) { sy = 64; a = ANI.DOWN; }
        else { sy = -64; a = ANI.UP; }

        // Prevent edge teleporting
        if (x + sx < 0) { sx = 64; a = ANI.RIGHT; }
        else if (x + sx > window.innerWidth - 64) { sx = -64; a = ANI.LEFT; }
        if (y + sy < 0) { sy = 64; a = ANI.DOWN; }
        else if (y + sy > window.innerHeight - 64) { sy = -64; a = ANI.UP; }

        const now = performance.now();
        [step.fx, step.fy] = here(now);
        step.at = now; step.dur = tick * MaxFrame;
        x += sx;
        y += sy;
        moving = true;
        setAnim(a);
      }
    }
    draw();
    frame++;
    ele.style.cursor = anim !== ANI.PET ? 'pointer' : 'default';
  };

  setInterval(update, tick);

  // petting: it stops right where it is (even mid-step, or waking from a doze) and enjoys it
  ele.addEventListener('click', () => {
    if (anim === ANI.PET) return;
    if (moving) {
      [x, y] = here();
      step.fx = x; step.fy = y;
      moving = false;
    }
    sleep = 0; hold = 0;
    setAnim(ANI.PET); draw();
  });

  return ele;
}

function generateScorsbys() {
  for (let i = 0; i < 5; i++) {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const y = Math.random() * (64 + window.innerHeight - 64);
    createSitePet('example', { side, y });
  }
}
