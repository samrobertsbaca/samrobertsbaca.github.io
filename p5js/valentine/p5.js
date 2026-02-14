
let angle = 0;
let hearts = [];

// --- ADJUSTABLE VARIABLES ---
let minDistance = 54.9;
let maxDistance = 150;
let kissFrequency = 0.033;
let verticalAmplitude = 44;

let faceTex, blinkTex, starsTex; // Added starsTex
let starAngle = 0; // Separate rotation variable for the stars

function preload() {
  faceTex = loadImage('/face.png');
  blinkTex = loadImage('/blink.png');
  starsTex = loadImage('/p5js/24cell/stars.png'); // Load your stars
}
function setup() {
  // 1. Create the canvas
  let cnv = createCanvas(800, 500, WEBGL);

  // 2. Attach it to your HTML container
  cnv.parent('scorsby-container');

  textureMode(NORMAL);
  noStroke();
}

function draw() {

  let proximityFactor = map(sin(frameCount * kissFrequency), -1, 1, 0, 1);
  let currentDist = lerp(minDistance, maxDistance, proximityFactor);

  // 2. Define your two target colors
  let colorCyan = color(0, 255, 255);
  let colorMagenta = color(255, 0, 255);

  // 3. Blend them based on the proximity factor
  // When proximityFactor is 0 (kissing), it will be Cyan
  // When proximityFactor is 1 (farthest), it will be Magenta
  let bgColor = lerpColor(colorCyan, colorMagenta, proximityFactor);

  // 4. Set the background
  background(bgColor);

  // --- DRAW SPINNING STARS ---
  push();
  // Move it far back on the Z-axis so it's behind everything
  translate(0, 0, -3000);
  // Spin the background slowly
  rotateZ(starAngle);
  texture(starsTex);
  // Create a large plane (2000x2000) to cover the whole view
  plane(2000, 2000);
  pop();

  starAngle += 0.002; // Adjust this for spin speed

  // --- 2D PULSATING HEART ---
  push();
  // Place it between the stars (-500) and the angels (0)
  translate(0, 0, -400);

  // 1. Calculate the opposite phase for the color
  // Adding PI ensures when the background is Cyan, this is Magenta (and vice-versa)
  let oppositeFactor = map(sin(frameCount * kissFrequency + HALF_PI + PI), -1, 1, 0, 1);
  let heartColor = lerpColor(colorCyan, colorMagenta, oppositeFactor);

  // 2. Calculate scale for pulsation
  // This pulses from 1.0 to 1.5 in sync with the proximity
  let heartScale = map(sin(frameCount * kissFrequency), -1, 1, 1.5, 1.0);
  scale(heartScale);

  // 3. Draw the Heart
  fill(heartColor);
  noStroke();

  beginShape();
  // Using your heart formula for a consistent look
  for (let a = 0; a < TWO_PI; a += 0.1) {
    let hx = 16 * pow(sin(a), 3);
    let hy = 13 * cos(a) - 5 * cos(2 * a) - 2 * cos(3 * a) - cos(4 * a);
    // Multiplying by 5 to make this "background" heart significantly larger
    vertex(hx * 5, -hy * 5);
  }
  endShape(CLOSE);
  pop();

  // orbitControl(1, 1, 0); // Reminder: use 0 to prevent the zoom issue
  ambientLight(120);

  orbitControl(1,1,0);
  ambientLight(120);
  pointLight(255, 255, 255, 0, -300, 300);

  // Determine which texture to use based on distance
  // If they are within 25 units of their closest point, they blink
  let activeTex = (currentDist < minDistance + 25) ? blinkTex : faceTex;

  let x1 = cos(angle) * currentDist;
  let y1 = sin(angle * 2) * verticalAmplitude;
  let z1 = sin(angle) * currentDist;

  let x2 = cos(angle + PI) * currentDist;
  let y2 = sin((angle * 2) + PI) * verticalAmplitude;
  let z2 = sin(angle + PI) * currentDist;

  let dy = y2 - y1;
  let dxz = dist(x1, z1, x2, z2);
  let pitch = atan2(dy, dxz);

  let sharedFlap = sin(frameCount * 0.12) * 1;

  if (currentDist < minDistance + 15) {
    if (frameCount % 4 === 0) {
      hearts.push(new HeartParticle(x1, y1, z1));
      hearts.push(new HeartParticle(x2, y2, z2));
    }
  }

  for (let i = hearts.length - 1; i >= 0; i--) {
    hearts[i].update();
    hearts[i].display();
    if (hearts[i].life <= 0) hearts.splice(i, 1);
  }

  // Blue Angel
  push();
  translate(x1, y1, z1);
  rotateY(-(angle + HALF_PI));
  rotateX(-pitch);
  drawHeavenlyBeing(color(60, 160, 255), activeTex, sharedFlap);
  pop();

  // Magenta Angel
  push();
  translate(x2, y2, z2);
  rotateY(-(angle + PI + HALF_PI));
  rotateX(pitch);
  drawHeavenlyBeing(color(255, 70, 190), activeTex, sharedFlap);
  pop();

  angle += 0.015;
}

function drawHeavenlyBeing(bodyColor, tex, flap) {
  // --- BODY ---
  push();
  fill(bodyColor);
  specularMaterial(bodyColor);
  sphere(65);
  pop();

  // --- FACE ---
  push();
  texture(tex);
  drawCurvedFace(66, 85, 85);
  pop();

  // --- EARS & HALO ---
  push();
  fill(bodyColor);
  translate(-50, -50, 0); sphere(24);
  translate(100, 0, 0); sphere(24);
  pop();

  push();
  translate(0, -105, 0);
  rotateX(HALF_PI);
  fill(255, 220, 100);
  torus(45, 6);
  pop();

  // --- TINTED WINGS ---
  let r = red(bodyColor);
  let g = green(bodyColor);
  let b = blue(bodyColor);
  fill(r, g, b, 200);

  stroke(255, 50);
  strokeWeight(2);

  push(); // Right Wing
  translate(50, -10, -30);
  rotateY(-flap + 0.4);
  drawWingShape(1);
  pop();

  push(); // Left Wing
  translate(-50, -10, -30);
  rotateY(flap - 0.4);
  drawWingShape(-1);
  pop();

  noStroke();
}

function drawWingShape(side) {
  beginShape();
  vertex(0, 0, 0);

  // Refined "Softer" Wing Path
  bezierVertex(40 * side, -55, 100 * side, -50, 130 * side, 0);
  bezierVertex(150 * side, 30, 130 * side, 60, 100 * side, 70);
  bezierVertex(70 * side, 75, 40 * side, 65, 20 * side, 40);
  bezierVertex(10 * side, 30, 5 * side, 15, 0, 0);

  endShape(CLOSE);
}

function drawCurvedFace(r, wDeg, hDeg) {
  let res = 20;
  let wRad = radians(wDeg);
  let hRad = radians(hDeg);
  for (let j = 0; j < res; j++) {
    beginShape(TRIANGLE_STRIP);
    for (let i = 0; i <= res; i++) {
      let lat1 = map(j, 0, res, -hRad/2, hRad/2);
      let lon = map(i, 0, res, -wRad/2, wRad/2);
      let lat2 = map(j+1, 0, res, -hRad/2, hRad/2);
      vertex(r*sin(lon)*cos(lat1), r*sin(lat1), r*cos(lon)*cos(lat1), i/res, j/res);
      vertex(r*sin(lon)*cos(lat2), r*sin(lat2), r*cos(lon)*cos(lat2), i/res, (j+1)/res);
    }
    endShape();
  }
}

class HeartParticle {
  constructor(x, y, z) {
    this.pos = createVector(x, y, z);
    this.vel = p5.Vector.random3D().mult(random(2, 5));
    this.life = 555;
    this.size = random(3, 9);
    this.swirlSeed = random(1000);

    // Pick a color once at the start
    // random(1) gives a number between 0 and 1
    if (random(1) > 0.5) {
      this.baseColor = color(0, 255, 255);   // Cyan
    } else {
      this.baseColor = color(255, 80, 150);  // Magenta/Pink
    }
  }

  update() {
    this.pos.add(this.vel);
    this.pos.x += sin(frameCount * 0.1 + this.swirlSeed) * 2;
    this.pos.y += cos(frameCount * 0.1 + this.swirlSeed) * 2;
    this.life -= 4;
  }

  display() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    rotateZ(PI);
    rotateY(frameCount * 0.1);

    // Apply the saved color and use this.life for transparency
    fill(red(this.baseColor), green(this.baseColor), blue(this.baseColor), this.life);

    beginShape();
    for (let a = 0; a < TWO_PI; a += 0.2) {
      let hx = 16 * pow(sin(a), 3);
      let hy = 13 * cos(a) - 5 * cos(2 * a) - 2 * cos(3 * a) - cos(4 * a);
      vertex(hx * (this.size / 12), hy * (this.size / 12));
    }
    endShape(CLOSE);
    pop();
  }
}
