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
  ele.style.zIndex = '500';
  document.body.appendChild(ele);

  const MaxFrame = 8;
  let anim = 0, frame = 0, sleep = 0, moving = false;
  let x, y;

  // Spawn off-screen
  const side = opts.side || (Math.random() < 0.5 ? 'left' : 'right');
  y = Math.floor((opts.y ?? Math.random() * (window.innerHeight - 64)) / 64) * 64;
  x = side === 'left' ? -64 : window.innerWidth;

  ele.style.top = `${y}px`;
  ele.style.left = `${x}px`;
  ele.style.transition = 'top 1500ms linear, left 1500ms linear';

  // Set initial direction
  const firstAnim = side === 'left' ? ANI.RIGHT : ANI.LEFT;
  const firstMove = side === 'left' ? 64 : -64;

  // Move pet into screen immediately
  //x += firstMove;
  ele.style.left = `${x}px`;
  anim = firstAnim;

  const setAnim = a => { frame = 0; anim = a; };

  const update = () => {
    let bgX = -64 * frame;
    let bgY = -64 * anim;
    ele.style.backgroundPosition = `${bgX}px ${bgY}px`;
    frame++;

    if (frame >= MaxFrame) {
      if (sleep > 0) {
        sleep--;
        moving = false;
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

        x += sx;
        y += sy;
        ele.style.left = `${x}px`;
        ele.style.top = `${y}px`;
        moving = true;
        setAnim(a);
      }
    }
    ele.style.cursor = (!moving && sleep <= 0 && anim !== ANI.PET) ? 'pointer' : 'default';
  };

  setInterval(update, 150 + Math.random() * 100);

  ele.addEventListener('click', () => {
    if (!moving && sleep <= 0 && anim !== ANI.PET) setAnim(ANI.PET);
  });

  return ele;
}

function generateScorsbys() {
  for (let i = 0; i < 13; i++) {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const x = Math.random() * (window.innherWidth - 64);
    const y = Math.random() * (64 + window.innerHeight - 64);
    createSitePet('example', { side, y });
  }
}
