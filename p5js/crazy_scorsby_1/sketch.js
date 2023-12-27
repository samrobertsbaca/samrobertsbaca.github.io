
let headDiameter;
let headX, headY;
let headSwayAmplitudeX = 60;
let headSwayAmplitudeY = 30;

let default_ppi = 300;
let default_grid_width = default_ppi;

let ear_size = .5;
let ear_dist = 1/5;

let eye_hdist = 1/11;
let eye_vdist = 1/26;
let eye_size = 1/3;

let pupil_size = 1/6;

let pupilX, pupilY;

let n_pupils = 2;
let pupil_Sizes = new Array(n_pupils).fill(0); 

let nose_size = 1/5;
let nose_dist = 1/22;
let noseX, noseY;

let mouth_weight = 10;
let mouth_width = 1/8;
let mouth_smile = 1/2;
let smileX, smileY;

let faceX, faceY;

let armsX, armsY;

let wiggle_room = 1.3

let font;

let img;

function preload() {
  //img = loadImage('./assets/sig_v3-01.png');
}

function inchesToPixels(inches, ppi = default_ppi) {
  return inches * ppi;
}

function cmykToRgb(cmykArray) {
    // Extract CMYK values from the array
    let [c, m, y, k] = cmykArray;

    // Convert CMYK to RGB
    let r = 255 * (1 - c / 100) * (1 - k / 100);
    let g = 255 * (1 - m / 100) * (1 - k / 100);
    let b = 255 * (1 - y / 100) * (1 - k / 100);

    // Round and return the RGB values in an array
    return [Math.round(r), Math.round(g), Math.round(b)];
}

function pointsToPixels(points, ppi = default_ppi) {
    return points * (ppi / 72);
}

function drawGrid(mainSpacing = default_grid_width, division = 8, mainStrokeWeight = 2, subStrokeWeight = 1) {
    // Draw main grid lines (bolder)
    strokeWeight(mainStrokeWeight);
    stroke(200);
    for (let x = 0; x <= width; x += mainSpacing) {
        line(x, 0, x, height); // Vertical lines
    }
    for (let y = 0; y <= height; y += mainSpacing) {
        line(0, y, width, y); // Horizontal lines
    }

    // Draw subdivision grid lines (thinner)
    strokeWeight(subStrokeWeight);
    stroke(225);
    let subSpacing = mainSpacing / division;
    for (let x = 0; x <= width; x += subSpacing) {
        if (x % mainSpacing !== 0) { // Avoid redrawing over main lines
            line(x, 0, x, height); // Vertical lines
        }
    }
    for (let y = 0; y <= height; y += subSpacing) {
        if (y % mainSpacing !== 0) { // Avoid redrawing over main lines
            line(0, y, width, y); // Horizontal lines
        }
    }
}

P5Capture.setDefaultOptions({
  format: "mp4",
  framerate: 60,
  quality: 1,
  width: 1200,
});

function setup() {
  
  //c_width = 1728;
  c_width = default_grid_width*4;
  createCanvas(c_width, c_width);
  
  //circleDiameter = width/2;
  headDiameter = default_grid_width*2;
  
  headX = width/2;
  headY = height/2;
  
  faceX = width / 2; // Initial nose position
  faceY = height / 2; // Initial nose position
  
  armsX = width / 2; // Initial nose position
  armsY = height / 2; // Initial nose position
  
  smileX = width / 2; // Initial nose position
  smileY = height / 2; // Initial nose position
  
  pupilX = width / 2; // Initial nose position
  pupilY = height / 2; // Initial nose position
  
  noseX = width / 2; // Initial nose position
  noseY = height / 2; // Initial nose position
  
  textFont("MS Gothic");
  textSize(inchesToPixels(.2));
  textAlign(CENTER,CENTER)
  
  //saveGif('mySketch', 3.56);
  
  
}

function animateCrazyPupils() {
    let maxSize = width * pupil_size; // Maximum size of pupils
    let increment = maxSize / n_pupils; // Size increment per pupil
    let pupils = [];

    // Create and calculate size for each pupil
    for (let i = 0; i < n_pupils; i++) {
        let size = (frameCount + i * increment)*.95 % maxSize;
        pupils.push({ index: i, size: size});
    }

    // Sort pupils by size, smallest last
    pupils.sort((a, b) => b.size - a.size);

    // Determine the color of the largest pupil
    let largestPupilColor = pupils[n_pupils - 1].index % 2 === 0 ? 0 : 255;
    let largestPupilColorAlt = pupils[n_pupils - 1].index % 2 === 0 ? 255 : 0;

    // Draw the eye backgrounds

    noStroke();
    fill(largestPupilColor);
    circle(pupilX - width * eye_hdist, pupilY - height * eye_vdist, headDiameter * eye_size);
  
    drawingContext.save();
    drawingContext.clip();
  
    // Draw the pupils in size order
    pupils.forEach(pupil => {
        // Alternate colors based on original index
        fill(pupil.index % 2 === 0 ? 0 : 255);

        // Draw the pupils
        circle(pupilX - width * eye_hdist /**cos(pupil.size/32)*/, pupilY - height * eye_vdist, pupil.size);
        circle(pupilX + width * eye_hdist /** cos(pupil.size/16)*/, pupilY - height * eye_vdist, pupil.size);
    });
  
  drawingContext.restore();
  
    fill(largestPupilColorAlt);
    circle(pupilX + width * eye_hdist, pupilY - height * eye_vdist, headDiameter * eye_size);

    drawingContext.save();
    drawingContext.clip();
  
    // Draw the pupils in size order
    pupils.forEach(pupil => {
        // Alternate colors based on original index
        fill(pupil.index % 2 === 0 ? 255 : 0);

        // Draw the pupils
        circle(pupilX - width * eye_hdist /**cos(pupil.size/32)*/, pupilY - height * eye_vdist, -pupil.size);
        circle(pupilX + width * eye_hdist /** cos(pupil.size/16)*/, pupilY - height * eye_vdist, -pupil.size);
    });
  
  drawingContext.restore();
}


/*function animateBG() {

    // Draw the eye backgrounds

    let sway = 100 *  cos(frameCount * 0.03);
    let pupil_size = width/1.5 - 2/sway;
  
    noStroke();
    fill([255,255,255]);

        // Draw the pupils
    circle(width/2 + sway, height/2 - sway/4, pupil_size);
}*/

function animateBG() {
  
  
    // Draw the eye backgrounds
    let sway = 100 * sin(frameCount * 0.03); // Sinusoidal sway for arc-like movement
    let swayAbs = abs(sway); // Absolute value for symmetric behavior

    // Adjust the pupil size - bigger in the center, smaller on sides
    let pupil_size = width / 1.5 - pow(swayAbs, 2) / 2000; // Non-linear adjustment
  
  
    let maxSize = width / 1.4; // Maximum size of pupils
    let increment = maxSize / (n_pupils*4); // Size increment per pupil
    let pupils = [];

    // Create and calculate size for each pupil
    /*for (let i = 0; i < (n_pupils*4); i++) {
        let size = (frameCount + i * increment) % maxSize;
        pupils.push({ index: i, size: size});
    }*/
  
    for (let i = 0; i < (n_pupils * 4); i++) {
    // Use an exponential function for size
      let size = Math.pow(1.01, (frameCount + i * increment) % maxSize);
      pupils.push({ index: i, size: size });
    }


    // Sort pupils by size, smallest last
    pupils.sort((a, b) => b.size - a.size);
  
    

    noStroke();
  
    // Determine the color of the largest pupil
    let largestPupilColor = pupils[n_pupils - 1].index % 2 === 0 ? 0 : 255;

    // Draw the eye backgrounds

    noStroke();
    fill(largestPupilColor);
    circle(width/2 - sway, height/2 - swayAbs/2 + 50, maxSize);
    
    pupils.forEach(pupil => {
        // Alternate colors based on original index
        fill(pupil.index % 2 === 0 ? 0 : 255);

        // Draw the pupils
        circle(width/2 - sway, height/2- swayAbs/2 + 50, pupil.size);
        circle(width/2 - sway, height/2- swayAbs/2 + 50, pupil.size *.75);
        circle(width/2 - sway, height/2- swayAbs/2 + 50, pupil.size * .5);
    });
  
  
    // Draw the pupils
  /*fill(0,0,0)
    circle(width / 2 - sway, height / 2, pupil_size);
    
  fill(255, 255, 255);
    circle(width / 2 - sway, height / 2, pupil_size *.75);
  
  fill(0,0,0)
    circle(width / 2 - sway, height / 2, pupil_size * .5);*/
}



function draw() {
    background(245);
  
    animateBG();
  
    //drawGrid();
  
    // Calculate the radius
    let radius = headDiameter / 2;
  
    // Set the stroke (outline) color of the circle
  
    let black = cmykToRgb([0,0,0,100])
  
    let white = cmykToRgb([0,0,0,0])
    
    let scyan = cmykToRgb([70.47, 34.1, 0, 0]);
  
    let magenta = cmykToRgb([0, 100, 0, 0]);
  
    let red = [255,0,0];
  
    //stroke(...black); // RGB values for color
    noStroke()
  
    // Set the stroke weight (thickness) of the circle
    strokeWeight(pointsToPixels(5)); // Pixels

    // Set the fill color of the circle
     // RGB values for color
  
    // Draw the circle
    // The circle is drawn at the center of the canvas
  
    // Calculate the head's swaying motion
    let sway_x = headSwayAmplitudeX * sin(frameCount * 0.03);
    let sway_y = headSwayAmplitudeY * sin(frameCount * 0.03) * cos(frameCount * 0.03);
    // Update the head's X position based on the swaying motion
    headX = width / 2 + sway_x;
    headY = height / 2 + (sway_y);

    blendMode(EXCLUSION);
    fill(...white);
    textFont("Comic Sans MS");
    textSize(inchesToPixels(.1));
    textAlign(LEFT,CENTER)
    text('sam rb', inchesToPixels(.05), height - inchesToPixels(.1));
    textAlign(RIGHT,CENTER)
    text('12/27/2023', width - inchesToPixels(.05), height - inchesToPixels(.1));
    blendMode(BLEND);
  
    fill(...scyan);
  
    // head
    circle(headX, headY, headDiameter);
  
    // body
    circle(headX, headY + inchesToPixels(1.8), headDiameter*1.1);
  
    
  
    //circle(width / 2, height / 2, headDiameter);
  
    faceX += (headX - faceX) * 0.1;
    faceY += (headY - faceY) * 0.1;
  
    armsX += (headX - faceX) * -0.1;
    armsY += (headY - faceY) * -0.1;
  
    pupilX += (headX - faceX) * .25;
    pupilY += (headY - faceY) * 0.3;
  
    // ears
    circle(faceX - width*ear_dist, faceY - height*ear_dist, headDiameter*ear_size);
    circle(faceX + width*ear_dist, faceY - height*ear_dist, headDiameter*ear_size);
  
    stroke(...scyan);
    noFill();
    strokeWeight(pointsToPixels(40));
    curve(
      width/2 + inchesToPixels(.5),smileY - height/2,
      
      faceX + inchesToPixels(.77),faceY + height/3.2,
      armsX + inchesToPixels(3),armsY + height,
      
      width/2 + smileX + inchesToPixels(10),smileY + height + inchesToPixels(1.5)
    );
  
    curve(
      width/2 - inchesToPixels(.5),smileY - height/2,
      
      faceX - inchesToPixels(.77),faceY + height/3.2,
      armsX - inchesToPixels(3),armsY + height,
      
      width/2 - smileX - inchesToPixels(10),smileY + height + inchesToPixels(1.5)
    );
  
    // eyes
    /*fill(...white);
    circle(width / 2 - width*eye_hdist, height/2 - height*eye_vdist, headDiameter*eye_size);
    circle(width / 2 + width*eye_hdist, height/2 - height*eye_vdist, headDiameter*eye_size);*/
    animateCrazyPupils();

    // pupils
    /*fill(...black);
    circle(width / 2 - width*eye_hdist, height/2 - height*eye_vdist, headDiameter*current_pupil_size);
    circle(width / 2 + width*eye_hdist, height/2 - height*eye_vdist, headDiameter*current_pupil_size);*/
  
  

    
  
    // nose
    noseX += (headX - faceX) * .25;
    noseY += (headY - faceY) * .4;
    fill(...red);
    circle(noseX,noseY+height*nose_dist + (smileY/32),headDiameter*nose_size);
  
    // mouth
    smileX += (headX - faceX) * .2;
    smileY += (headY - faceY) * .3;
    noFill();
    strokeWeight(pointsToPixels(10));
    stroke(...black);
    curve(
      smileX - width*mouth_width,pupilY - height/2,
      smileX - width*mouth_width,smileY + height/12,
      smileX + width*mouth_width,smileY + height/12,
      smileX + width*mouth_width,pupilY - height/2
    )
  
    strokeWeight(pointsToPixels(2));
    fill(...white);

    triangle(width/2 + width/7 + (sway_x/5 - 5), height/2+inchesToPixels(.87)+smileY/4.5 - inchesToPixels(.16), 
             width/2 - inchesToPixels(.05) + width/7 + width/48, height/2+inchesToPixels(.87)+smileY/5,
             width/2 + inchesToPixels(.05) + width/7 + width/48, height/2+inchesToPixels(.87)+smileY/5);
    fill(...white);
    rect(width/2-inchesToPixels(1.4), height/2+inchesToPixels(.87)+smileY/5, inchesToPixels(2.8), inchesToPixels(.3), 20, 20, 20, 20);     
  
    noStroke();
    fill(...black);
    textFont("MS Gothic");
    textSize(inchesToPixels(.2));
    textAlign(CENTER,CENTER)
    text('have a nice day... or else', width/2, height-inchesToPixels(.98)+smileY/5);
  
  
    let timeInSeconds = frameCount / frameRate();

    
    /*if (frameCount === 1) {
      const capture = P5Capture.getInstance();
      capture.start({
        format: "mp4",
        duration: 666,
      });
    }*/
  
    /*if (frameCount % 212 ==0) {
      frameCount = 0;
      print("Time: " + timeInSeconds.toFixed(2) + " seconds", 10, 20);
      
    }*/
  
    //print(sway_x);
    /*if (sway_x == 0) {
      print(frameCount);
      exit();
    }*/
  
    //image(img, 0, 0, width, height, 0, 0, img.width, img.height, CONTAIN);
  
}