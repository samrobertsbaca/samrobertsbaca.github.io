let vertices4D = [];
let edges = [];

let angle = 0;

// drag rotation state
let rotX = 0;
let rotY = 0;
let lastX, lastY;
let dragging = false;

let heartImg;
let rainbowImg;
let starImg;
let bgImg;
let bgZia;

let bgZia1;
let bgZia2;
let bgZia3;

let scaleFactor;

let needsTouchSync = false;

let globScale = 1;

let yOffset = -120;

const CELL_RADIUS = 130*globScale; // tweak as needed
const IDLE_SPIN = 0.00015; // tune this
let idleDirection = 1; // +1 or -1

function preload() {
  heartImg = loadImage("./p5js/24cell/favicon_gold2.png"); // make sure heart.png is in your project folder
  rainbowImg = loadImage("./p5js/24cell/rainbow.png");
  starImg = loadImage("./p5js/24cell/stars.png");
  //bgImg = loadImage('./p5js/24cell/bg.png');
  //bgZia = loadImage('./p5js/24cell/zia_site.png')

  bgZia1 = loadImage('./p5js/24cell/zia_stripes.png')
  bgZia2 = loadImage('./p5js/24cell/zia_leaves.png')
  bgZia3 = loadImage('./p5js/24cell/zia_zia.png')
}

function setup() {

  // create canvas with adjusted height
  let cnv = createCanvas(windowWidth, windowHeight + yOffset, WEBGL);
  cnv.parent('p5-container');

  // switch to orthographic
  ortho(
    -width/2, width/2,
    -height/2, height/2,
    -1000, 1000
  );


  cnv.touchStarted(() => {
    dragging = true;

    if (pointerDistFromCenter() < CELL_RADIUS) {
      dragMode = 'cell';
      needsTouchSync = true;
    } else {
      dragMode = 'record';
      needsRecordSync = true;
      startZiaDrag();   // ✅ THIS WAS MISSING
    }

    return false;
  });

  cnv.touchMoved(() => {
    if (!dragging || touches.length === 0) return false;

    // --- 24-cell drag ---
    if (dragMode === 'cell') {
      if (needsTouchSync) {
        lastX = touches[0].x;
        lastY = touches[0].y;
        needsTouchSync = false;
        return false;
      }
      dragMove();
    }

    // --- record spin ---
    if (dragMode === 'record') {

      moveZiaDrag();
    }

    return false;
  });

  cnv.touchEnded(() => {
    //if (dragMode === 'cell') endDrag();
    //if (dragMode === 'record') endZiaDrag();

    handleRelease();
    dragging = false;
    //dragMode = null;
    //needsTouchSync = false;
    //needsRecordSync = false;

    return false;
  });

  stroke(255);
  noFill();

  // ---- 24-cell vertices ----

  init24Cell_B4()
}

function init24Cell_B4() {
  vertices4D = [];
  edges = [];

  const a = 1;
  const b = 0.5;

  // axes
  const axes = [
    [ a, 0, 0, 0], [-a, 0, 0, 0],
    [ 0, a, 0, 0], [ 0,-a, 0, 0],
    [ 0, 0, a, 0], [ 0, 0,-a, 0],
    [ 0, 0, 0, a], [ 0, 0, 0,-a]
  ];
  vertices4D.push(...axes);

  // half-cube
  for (let x of [-b, b])
    for (let y of [-b, b])
      for (let z of [-b, b])
        for (let w of [-b, b])
          vertices4D.push([x, y, z, w]);

  const EDGE_LEN = 1;
  const EPS = 0.01;

  for (let i = 0; i < vertices4D.length; i++) {
    for (let j = i + 1; j < vertices4D.length; j++) {
      let d = dist4(vertices4D[i], vertices4D[j]);
      if (abs(d - EDGE_LEN) < EPS) {
        edges.push([i, j]);
      }
    }
  }

  console.log("vertices:", vertices4D.length); // should be 24
  console.log("edges:", edges.length);         // should be 96
}




let starAngle = 0; // global variable for
let ziaAngle = 0;
let ziaSpin = 0;        // angular velocity
let ziaDragging = false;
let lastAngle = 0;

let dragMode = null;
// 'cell' | 'record' | null


function pointerDistFromCenter() {
  let x = mouseX - width / 2;
  let y = mouseY - (height/2);
  return sqrt(x*x + y*y);
}

function pointerAngle() {
  let x = mouseX - width / 2;
  let y = mouseY - (height/2); // adjust vertical
  return atan2(y, x);
}


function handlePress() {
  if (pointerDistFromCenter() < CELL_RADIUS) {
    dragMode = 'cell';
    startDrag();        // your existing 3D rotation
  } else {
    dragMode = 'record';
    startZiaDrag();     // record spin
  }
}

function handleDrag() {
  if (dragMode === 'cell') {
    dragMove();
  } else if (dragMode === 'record') {
    moveZiaDrag();
  }
}

function handleRelease() {
  if (dragMode === 'cell') {
    endDrag();
  } else if (dragMode === 'record') {
    endZiaDrag();
  }
  dragMode = null;
}


function startZiaDrag() {
  ziaDragging = true;
  lastAngle = pointerAngle();
}

function moveZiaDrag() {
  if (!ziaDragging) return;

  let a = pointerAngle();
  let delta = a - lastAngle;

  // keep rotation continuous across PI / -PI
  if (delta > PI) delta -= TWO_PI;
  if (delta < -PI) delta += TWO_PI;

  ziaSpin = delta;     // velocity
  ziaAngle += delta;  // rotation

  // 👇 remember user's direction
  if (abs(delta) > 0.0005) {
    idleDirection = Math.sign(delta);
  }

  lastAngle = a;
}

function endZiaDrag() {
  ziaDragging = false;
}

function draw() {
  //background(0);
  //background(bgImg);
  clear();

  /*
  push();
  resetMatrix();       // ignore rotations
  rotate(ziaAngle);
  translate(0, 0, -200); // slightly behind other elements
  imageMode(CENTER);
  image(bgZia3, 0, 0, height * globScale, height * globScale); // scale to canvas
  rotate(ziaAngle*2);
  image(bgZia2, 0, 0, height * globScale, height * globScale); // scale to canvas
  rotate(ziaAngle*3);
  image(bgZia1, 0, 0, height * globScale, height * globScale); // scale to canvas
  pop();
  */

  if (!ziaDragging) {
    ziaSpin += idleDirection * IDLE_SPIN;   // gentle motor
    ziaAngle += ziaSpin;
    ziaSpin *= 0.96;       // friction
  }

  //ziaAngle += 0.005;

  // apply interactive rotation
  rotateX(rotX);
  rotateY(rotY);

  // gentle autonomous rotation
  rotateX(angle * 0.2);
  rotateY(angle * 0.15);

  let projected = [];

  for (let v of vertices4D) {
    let r = rotate4D(v, angle, angle * 0.7);
    let p = project4Dto3D(r);
    projected.push(p);
  }

  scale(100 * globScale);





  drawRainbowGradient(90 * globScale,33)
  drawHeartRainbow(33 * globScale)

  push();
  resetMatrix();                  // ignore 3D scene rotations
  translate(0, 0, -200);           // place it behind the 24-cell along Z
  rotate(ziaAngle);              // rotate around center
  imageMode(CENTER);
  tint(255, 255);                 // optional transparency
  //image(rainbowImg,0,0,800,800);
  image(starImg, 0, 0, 280 * globScale, 280 * globScale); // draw at origin
  pop();

  starAngle += 0.005; // increment angle for next frame


  // draw edges
  stroke(255, 255, 255);
  strokeWeight(2);
  for (let e of edges) {
    let a = projected[e[0]];
    let b = projected[e[1]];
    line(a.x, a.y, a.z, b.x, b.y, b.z);
  }

  // draw vertices
  stroke(255);
  for (let p of projected) {
    push();
    translate(p.x, p.y, p.z);
    //sphere(0.03);
    pop();
  }

  angle += 0.005;

  rotX *= 0.98;
  rotY *= 0.98;
}

let hueOffset = 0; // global for cycling
let gradientOffset = 0;

function drawHeartRainbow(size = 1) {
  push();

  // Reset rotation so it faces the camera
  resetMatrix();

  // Move to center of canvas (WEBGL origin)
  translate(0, 0, 500);

  colorMode(HSB, 360); // use hue from 0-360
  stroke((gradientOffset + 180) % 360, 360, 360);
  strokeWeight(0)
  fill((gradientOffset + 180) % 360, 360, 360); // complementary fill
  strokeWeight(1);

  beginShape();
  for (let t = 0; t <= TWO_PI; t += 0.05) {
    let x = 16 * pow(sin(t), 3);
    let y = - (13 * cos(t) - 5 * cos(2*t) - 2 * cos(3*t) - cos(4*t));
    vertex(x * 0.02 * size, y * 0.02 * size, 0);
  }
  endShape(CLOSE);

  pop();

  // increment hue for next frame
  hueOffset += 1;
}

function drawRainbowGradient(radius = 500, steps = 135) {
  push();
  resetMatrix();
  translate(0, 0,-200); // center
  noStroke();
  colorMode(HSB, 360, 100, 100, 100); // alpha enabled

  let dynamicSteps = steps + abs(ziaSpin) * 300; // tune multiplier

  for (let i = 0; i < steps; i++) {
    let r = map(i, 0, dynamicSteps, radius, 0); // outer to inner
    let t = i / dynamicSteps;

    // Rotate hue with both global offset and spinning
    let hue = (hueOffset + t * 180 + ziaAngle * 180 / PI) % 360;
    gradientOffset = hue;
    /*
    let r = map(i, 0, steps, radius, 0); // outer to inner
    let t = i / steps;

    // Hue gradient: complementary at center, full rainbow outward
    let hue = (hueOffset + t * 180) % 360;*/

    // Fade alpha toward edges
    let alpha = map(r, radius, 0, 0, 100);

    fill(hue, 100, 100, alpha);
    ellipse(0, 0, r * 2.7, r * 2.7);
  }

  pop();
}




// ---- mouse / touch interaction ----

function getInputX() {
  return touches.length ? touches[0].x : mouseX;
}

function getInputY() {
  return touches.length ? touches[0].y : mouseY;
}

//function mousePressed() {
//  if (touches.length > 0) return; // ignore mouse if touch is active
//  console.log(dragMode, pointerDistFromCenter());
//  handlePress();
//}

function mousePressed() {
  if (pointerDistFromCenter() < CELL_RADIUS) {
    dragMode = 'cell';
    startDrag();
  } else {
    dragMode = 'record';
    startZiaDrag();   // ✅ REQUIRED
  }
}

function mouseDragged() {
  handleDrag();
}

function mouseReleased() {
  handleRelease();
  dragging = false;
}



function startDrag() {
  dragging = true;
  lastX = getInputX();
  lastY = getInputY();
}


function dragMove() {
  let x = touches.length ? touches[0].x : mouseX;
  let y = touches.length ? touches[0].y : mouseY;

  let dx = x - lastX;
  let dy = y - lastY;

  rotY -= dx * 0.005;
  rotX += dy * 0.005;

  lastX = x;
  lastY = y;
}

function endDrag() {
  dragging = false;
}



// ---- math helpers ----

function rotate4D(v, a, b) {
  let [x, y, z, w] = v;

  // rotate in XW plane
  let x1 = x * cos(a) - w * sin(a);
  let w1 = x * sin(a) + w * cos(a);

  // rotate in YZ plane
  let y1 = y * cos(b) - z * sin(b);
  let z1 = y * sin(b) + z * cos(b);

  return [x1, y1, z1, w1];
}

function project4Dto3D(v) {
  let [x, y, z, w] = v;
  let d = 2;
  let scale = d / (d + w);
  return createVector(x * scale, y * scale, z * scale);
}

function dist4(a, b) {
  return sqrt(
    sq(a[0] - b[0]) +
    sq(a[1] - b[1]) +
    sq(a[2] - b[2]) +
    sq(a[3] - b[3])
  );
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
