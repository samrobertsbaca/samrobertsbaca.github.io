let faceImg;
let textureCanvas;
let bubbles = [];

let armSegments = 25;
let armLength = 200;
let bottomTentacles = 6;
let bottomSegments = 25;
let bottomLength = 180;

function preload() {
  faceImg = loadImage(
  "/js/scorsbypus/face.png",
  () => console.log("Image loaded successfully"),
  () => console.error("Failed to load image")
);// Replace with your face image
}

function windowResized() {
  const container = document.getElementById('p5-container');
  resizeCanvas(container.offsetWidth, container.offsetHeight);
}

function setup() {
  const container = document.getElementById('p5-container');
  canvas = createCanvas(container.offsetWidth, container.offsetHeight);
  canvas.parent(container);

  //createCanvas(windowWidth, windowHeight, WEBGL);
  textureCanvas = createGraphics(1024, 512);

  // Create initial bubbles
  for (let i = 0; i < 70; i++) {
    bubbles.push({
      x: random(-width / 2, width / 2),
      y: random(-height / 2, height / 2),
      z: random(-800, -200),
      size: random(6, 20),
      speed: random(0.5, 1.5)
    });
  }
}

function draw() {
  background('#014f86'); // Ocean blue

  drawLightBeams(); // ✅ Better underwater light shafts
  drawBubbles();    // ✅ Rising bubbles

  // Bobble and float
  let bobble = sin(frameCount * 0.03) * 0.15;
  let yOffset = sin(frameCount * 0.02) * 10;

  // Balloon texture
  textureCanvas.clear();
  textureCanvas.background("#28ACE2");
  let faceSize = 200;
  textureCanvas.imageMode(CENTER);
  textureCanvas.image(faceImg, textureCanvas.width / 2, textureCanvas.height / 2, faceSize, faceSize);

  // Bottom tentacles
  push();
  translate(0, yOffset - 50, 0);
  for (let t = 0; t < bottomTentacles; t++) {
    let angleStep = TWO_PI / bottomTentacles;
    let baseX = cos(t * angleStep) * 40;
    let baseZ = sin(t * angleStep) * 40;
    drawXTentacle(baseX, 60, baseZ, bottomSegments, bottomLength, 20, 6, 0.05);
  }
  pop();

  // Two side arms
  push();
  translate(0, yOffset - 50, 0);
  drawXTentacle(-80, 0, 0, armSegments, armLength, 30, 6, 0.05);
  drawXTentacle(80, 0, 0, armSegments, armLength, 30, 6, 0.05);
  pop();

  // Balloon head
  push();
  translate(0, yOffset - 50, 0);
  rotateY(PI);
  rotateX(bobble);
  noStroke();
  texture(textureCanvas);
  sphere(80, 50, 50);
  pop();

  // Ears
  push();
  translate(0, yOffset - 50, 0);
  rotateY(PI);
  rotateX(bobble);
  fill("#28ACE2");
  noStroke();
  let earOffsetY = -70;
  let earOffsetX = 40;
  push();
  translate(-earOffsetX, earOffsetY, 0);
  sphere(20);
  pop();
  push();
  translate(earOffsetX, earOffsetY, 0);
  sphere(20);
  pop();
  pop();
}

// Tentacles with fixed base and sine-wave tips
function drawXTentacle(x, y, z, segments, length, amplitude, frequency, speed) {
  push();
  translate(x, y, z);
  stroke("#28ACE2");
  strokeWeight(6);
  noFill();

  beginShape();
  for (let i = 0; i < segments; i++) {
    let progress = i / (segments - 1);
    let segLen = length * progress;
    let wave = sin(frameCount * speed + i * frequency) * amplitude * progress;

    let posX = wave;
    let posY = segLen;
    let posZ = 0;

    curveVertex(posX, posY, posZ);
  }
  endShape();
  pop();
}

// ✅ Smooth, animated light beams for underwater look
function drawLightBeams() {
  push();
  translate(0, -444, -700); // Place light rays behind everything
  noStroke();

  for (let i = 0; i < 6; i++) {
    let baseX = map(i, 0, 5, -width / 2, width / 2);
    let drift = sin(frameCount * 0.01 + i) * 50; // Gentle left-right sway
    let alpha = 10 + 20 * sin(frameCount * 0.02 + i * 2); // Flicker effect

    let topX = baseX + drift;
    let topY = 0;
    let bottomX1 = topX - 200; // Diagonal spread left
    let bottomX2 = topX + 200; // Diagonal spread right
    let bottomY = height+2000;

    // Draw gradient-like beams using layered quads
    for (let j = 0; j < 5; j++) {
      fill(255, 255, 255, alpha - j * 8);
      beginShape();
      vertex(topX, topY, 0);
      vertex(topX + 100, topY, 0);
      vertex(bottomX2, bottomY, 0);
      vertex(bottomX1, bottomY, 0);
      endShape(CLOSE);
    }
  }
  pop();
}

// ✅ Animated bubbles
function drawBubbles() {
  push();
  noStroke();
  for (let b of bubbles) {
    let progress = map(b.y, height / 2, -height / 2, 0, 1); // 0 at bottom, 1 at top
    let alpha = 120 * sin(progress * PI); // Smooth fade-in/out

    push();
    fill(255, 255, 255, alpha);
    translate(b.x, b.y, b.z);
    sphere(b.size / 2);
    pop();

    // Move bubble upward
    b.y -= b.speed;

    // Respawn at bottom
    if (b.y < -height / 2) {
      b.y = height / 2 + random(50, 200);
      b.x = random(-width / 2, width / 2);
      b.z = random(-800, -200);
      b.size = random(6, 20);
      b.speed = random(0.5, 1.5);
    }
  }
  pop();
}
