let n = 16; // Number of circles
let initialRadius = 500 + 200; // Radius of the largest circle
let initialGap = 10; // Initial distance between the edges of adjacent circles
let initialColor;
let angle = [];

P5Capture.setDefaultOptions({
  format: "mp4",
  framerate: 60,
  quality: 1,
  width: 1080,
});


function setup() {
  
  colorMode(HSB);
  
  createCanvas(1200, 1200*1.25);
  frameRate(60);
  // Initialize angle array
  for (let i = 0; i < n; i++) {
    angle.push(0);
  }
}

function draw() {
  colorMode(HSB);
  initialColor = color(255,100,30);
  
  background(initialColor);

  /*noStroke();
  fill(color(255-Math.abs(blue(initialColor))+20,
             Math.abs(green(initialColor)),
             Math.abs(red(initialColor))
      ));
  circle(width/2 - width/32, height/2, initialRadius);*/
  
  // Draw the recursive circles
  drawCircle(width / 2 - width/32, height / 2, initialRadius, 0, initialGap, initialColor);
  
  drawSig();
  
  if (frameCount === 1) {
      const capture = P5Capture.getInstance();
      capture.start({
        format: "mp4",
        duration: 3600,
      });
    }
  
}

function drawNGon(x, y, w, h, n, angle) {
  let angleOffset = radians(angle); // Convert angle from degrees to radians

  beginShape();
  for (let i = 0; i < n; i++) {
    let vertexAngle = TWO_PI / n * i + angleOffset; // Angle for each vertex with rotation
    let vx = x + (w / 2) * cos(vertexAngle); // x coordinate of vertex, scaled by width
    let vy = y + (h / 2) * sin(vertexAngle); // y coordinate of vertex, scaled by height
    vertex(vx, vy);
  }
  endShape(CLOSE); // Close the shape
}

function drawCircle(x, y, radius, depth, gap, c) {
  
  let nextRadius = radius / (1.05+(depth/50));
  
  if (depth >= n - 1) {
    noStroke();
    //fill(color(155-red(c)-5*(gap/12),155-blue(c)+5*(gap/24),155-green(c)+5*(gap/16)));
    //ellipse(x, y, radius * 1.5, radius * 1.5);
    //ellipse(x, y, radius * 2, radius * 2);
    //fill(255);
    //fill(color(red(c)-5*(gap/12),blue(c)+5*(gap/24),green(c)+5*(gap/16)));
    //ellipse(x,y, radius * 1.5, radius * 1.5);
    //fill(0);
    
    fill(200,100,100);
    //glow(c,1000/gap);
    ellipse(x,y,radius*.9,radius*.9);
    //drawNGon(x,y, radius * .9, radius * .9);
    angle[depth] += 0.2 * (depth);
    return;
  }

  // Draw the current circle
  fill(c);
  noStroke();
  //ellipse(x, y, radius * 2, radius * 2);
  //glow(initialColor,gap*100);
  //ellipse(x, y, radius * 2, radius * 2);
  drawNGon(x,y,radius*2,radius*2,depth+5,angle[depth]*10);
  //drawNGon(x,y,radius*2,radius*2,16-depth*cos(angle[depth])+1,angle[depth]*10);

  if (depth < n - 1) {
    // Calculate the radius for the next circle
    //let nextRadius = radius / 1.11;

    // Calculate the x, y position for the next circle
    let nextX = x + (radius - nextRadius - gap) * cos(angle[depth]);
    let nextY = y + (radius - nextRadius - gap) * sin(angle[depth]);

    // Draw the next circle
    let nextGap = (gap * 1.005) + 1.5; // Decrease the gap for the next recursive call

    /*drawCircle(nextX, nextY, nextRadius, depth + 1, nextGap, color(Math.abs(blue(c)+20*(gap/4)),
                                                                   Math.abs(green(c)+50*(gap/6)),
                                                                   Math.abs(red(c)-100*(gap/12))
                                                                  ));*/

    drawCircle(nextX, nextY, nextRadius, depth + 1, nextGap, color(Math.abs(hue(c)-2*(gap/13)),
                                                                   saturation(c)+10*(gap/2),
                                                                   brightness(c)+5*(depth/5))
              );
    
  }

  // Update the angle for the next frame
  angle[depth] += 0.05 * (depth) / (gap);
  
  if (Math.floor(angle[0])%360 == 1) {
    print(angle[0],frameCount);
  }
  
}

function glow(glowColor, blurriness) {
  drawingContext.shadowColor = glowColor;
  drawingContext.shadowBlur = blurriness;
}

function drawSig() {
  
    colorMode(RGB);
    fill(0, 122, 255);
    textFont("MS Gothic");
    textSize(20);
    textAlign(LEFT,CENTER)
    text('sam rb', 20, height - 25);
    textAlign(RIGHT,CENTER)
    text('12-29-2023', width - 20, height - 25);
  
}
