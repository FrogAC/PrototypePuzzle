let canvas;
// Shader
let shader3d;
let w3d, h3d;
let pg3d;
let shader2d;
const w2d = h2d = 64;
let pg2d, pg2d2;
// ml
let imgBg, imgCompose;
let classifier;
let label;
let confi = 0;
// game
let showDebug;
let btnHelp;
let isGame;
let title, helpInfo, gameInfo;
// game states
let tarList = ['rain','snowman','cat'];
let curTar;
let curPos;
let curScale;
let curIso;
let curStep;
// serial
const serial = new Serial();
serial.on(SerialEvents.CONNECTION_OPENED, onSerialConnectionOpened);
serial.on(SerialEvents.CONNECTION_CLOSED, onSerialConnectionClosed);
serial.on(SerialEvents.DATA_RECEIVED, onSerialDataReceived);
serial.on(SerialEvents.ERROR_OCCURRED, onSerialErrorOccurred);
serial.autoConnectAndOpenPreviouslyApprovedPort({ baudRate: 115200  });
let useSerial = false;
let recQueue = [];

// P5 ///////////////////////////////////////////////////////////

function resetImgBuffers() {
  for(var i = 0; i < w2d*h2d; i++) {
    imgCompose.pixels[i*4] = 255;
    imgCompose.pixels[i*4+1] = 255;
    imgCompose.pixels[i*4+2] = 255;
    imgCompose.pixels[i*4+3] = 255;
    imgBg.pixels[i*4] = 255;
    imgBg.pixels[i*4+1] = 255;
    imgBg.pixels[i*4+2] = 255;
    imgBg.pixels[i*4+3] = 255;
  }
  imgCompose.updatePixels();
  imgCompose.loadPixels();
  imgBg.updatePixels();
  imgBg.loadPixels();
  serialWriteImageData(imgCompose);
}

function preload(){
  // load the shader
  shader3d = loadShader('shader.vert', 'noise3d.frag');
  shader2d = loadShader('shader.vert', 'noise2d.frag');
  classifier = ml5.imageClassifier('DoodleNet');
}

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.position (0, 0);
  canvas.style('z-index', '0');
  noStroke();

  setWinSize();
  pg3d = createGraphics(w3d, h3d, WEBGL);
  pg3d.noStroke();
  pg2d = createGraphics(w2d, h2d, WEBGL);
  pg2d2 = createGraphics(pg2d.width, pg2d.height);
  pg2d.noStroke();

  imgBg = createImage(w2d, h2d);
  imgCompose = createImage(w2d, h2d);

  // game
  isGame = false;
  showDebug = true;
  title = createDiv('Me, Meow, <br>Multidimentional <br>Monstrousness');
  title.id('title');
  title.style('font-family', 'Helvetica');
  title.style('color:#FFFFFF');
  title.style('text-shadow: 2px 4px 4px rgba(0,0,0,0.2),0px -5px 10px rgba(255,125,125,0.25)');
  title.mousePressed(playPressed);
  title.style('user-select: none');
  title.position(0, 0);
  fitty('#title');

  curPos = new Vector(0,0,0);
  curScale = 2.0;
  curIso = 0.5;

  // help info
  helpInfo = createDiv('Try to compose desired object!<br> Use [up][down][left][right][w][s][a][d] to navigate.<br> Use [z] to store result, [x] to clear canvas');
  helpInfo.id('helpInfo');
  helpInfo.style('font-family', 'Helvetica');
  helpInfo.style('background-color','#FFFFFF');
  helpInfo.style('color','#E21118');
  helpInfo.style('font-size','1.5em');
  helpInfo.center();
  helpInfo.style('top', '3.5em');
  helpInfo.hide();

  // classifer
  label = createDiv('...');

  label.position(0, height - h2d * 2 - 20);
  label.id('label');
  label.style('color','#ffffff');

  label.hide();

  frameRate(120);

  // serial
}


let isoS = 0.02;
function draw() {  
  // shader() sets the active shader with our shader
  pg3d.shader(shader3d);
  pg2d.shader(shader2d);
  shader3d.setUniform("iResolution", [w3d, h3d]);
  shader3d.setUniform("npos", [curPos.x, curPos.y, curPos.z]);
  shader3d.setUniform("nscale", curScale);
  shader3d.setUniform("niso", curIso * (1-0.1*sin(millis()/500.)));
  shader3d.setUniform("iMouse", [mouseX, map(mouseY, 0, height, height, 0)]);

  shader2d.setUniform("iResolution", [w2d, h2d]);
  shader2d.setUniform("npos", [curPos.x, curPos.y, curPos.z]);
  shader2d.setUniform("nscale", curScale);
  shader2d.setUniform("niso", curIso);

  // rect gives us some geometry on the screen
  pg3d.rect(0,0,w3d, h3d);
  pg2d.rect(0,0,w2d, h2d);
  image(pg3d, (windowWidth - w3d)/2., 0);

  if (isGame) { 
    var isSerialReceived = false;
    var cmdZ = false;
    var cmdX = false;
    var cmdIso = -1;
    if (recQueue.length > 0) { 
      isSerialReceived = true;
      var cmd = recQueue.pop();
      cmdIso = parseInt(cmd);
      if (!isNaN(cmdIso)) {
        // [0,4096] -> [-2.3,4]
        curIso -= max(-0.1, min(curIso - (cmdIso / (4096/6.3) - 2.3), 0.1));
      } else if (cmd === 'Z') {
        cmdZ = true;
      } else if (cmd === 'X') {
        cmdX = true;
      }
    }

    // image processing
    if (keyIsDown(90) || cmdZ) { // z
      pg2d2.image(pg2d,0,0);
      imgBg.blend(pg2d2, 0,0,w2d, h2d,0,0,w2d, h2d, MULTIPLY);
      imgBg.loadPixels();
      imgCompose.blend(pg2d2, 0,0,w2d, h2d,0,0,w2d, h2d, MULTIPLY);
      imgCompose.loadPixels();
      serialWriteImageData(imgCompose);
    } else if (keyIsDown(88) || cmdX) { // x
      resetImgBuffers();
    }

    // movement
    const step = 0.0015;
    if (keyIsPressed === true) {
      curStep = min(curStep + step, 0.3);
    } else {
      curStep = 0;
    }
    var easedStep = curStep;
    if (isNaN(easedStep)) easedStep = 0.0;
    // easedStep = easedStep < 0.5 ? 2 * easedStep * easedStep : 1 - pow(-2 * easedStep + 2, 2) / 2;
    // easedStep /= 5;
    if (keyIsDown(LEFT_ARROW)) {
      curPos.add([-easedStep, 0, 0]);
    }
    if (keyIsDown(RIGHT_ARROW)) {
      curPos.add([easedStep, 0, 0]);
    }
    if (keyIsDown(UP_ARROW)) {
      curPos.add([0,easedStep, 0]);
    }
    if (keyIsDown(DOWN_ARROW)) {
      curPos.add([0, -easedStep, 0]);
    }
    if (keyIsDown(87)) { // w
      curPos.add([0, 0, -easedStep]);
    }
    if (keyIsDown(83)) { // s
      curPos.add([0, 0, easedStep]);
    }
    if (keyIsDown(65)) { // a
      curIso -= easedStep;
    }
    if (keyIsDown(68)) { // d
      curIso += easedStep;
    }
    if (mouseIsPressed === true) {
      // disable
      // onButtonConnectToSerialDevice();
    }
    curIso = Math.max(-2.3, Math.min(curIso, 4.0));
    if (keyIsPressed | isSerialReceived === true) {
      classify();
    }

    // level update
    if (confi > 0.8) {
      curTar += 1;
      gameInfo.html(tarList[curTar]);
      resetImgBuffers();
      confi = 0;
      var start = millis();
      var it = setInterval(function () {
        if (millis() - start > 1000) {
          clearInterval(it);
        }
        curIso += 0.1;
      },30);
    }
  } else {
    // loop animation
    if (curIso > 4.0 || curIso < -2.3) {
      isoS = -isoS;
    } 
    curIso += isoS;
  }

  if (showDebug) { 
    image(pg2d,0, height - h2d);
    image(imgBg,w2d, height - h2d);
    image(imgCompose,w2d*2, height - h2d);
  } 
}

// ML5 /////////////////////////////////////////////////////

let lastSend = 0;
function classify() {
  // add image
  imgCompose.copy(imgBg, 0,0,w2d, h2d,0,0,w2d, h2d);
  pg2d2.image(pg2d, 0,0);
  imgCompose.blend(pg2d2, 0,0,w2d, h2d,0,0,w2d, h2d, MULTIPLY);
  imgCompose.loadPixels();
  // classify
  classifier.classify(imgCompose, (err, res) => {
    if (err) { console.error(error); }
    var str = ``;
    for (var i = 0; i < 6; i++) {
      str = str.concat(`${res[i].label}(${nf(res[i].confidence, 0, 2)})<br>`);
    }
    // game update
    confi = 0;
    for (var i = 0; i < 6; i++) {
      if (res[i].label === tarList[curTar]) {
        confi = min(res[i].confidence * 5, 1.0);
        break;
      }
    }
    str = str.concat(`${nf(confi,0,2)}`);
    label.html(str);

    if (millis() - lastSend > 500) {
      lastSend = millis();
      // serialWriteImageData(imgCompose);
    }

  });
}

// callbck /////////////////////////////////////////////////

function playPressed() {
  btnHelp = createDiv('?');
  btnHelp.id('btnHelp');
  btnHelp.style('position:absolute;right:0;top:0');
  btnHelp.style('margin', '10px');
  btnHelp.style('font-family', 'Helvetica');
  btnHelp.style('user-select: none');
  btnHelp.style('color:#ff99cc');
  btnHelp.style('font-size', '2.3em');
  btnHelp.style('text-shadow: 0px 0px 6px rgba(255,255,255,0.7)');
  btnHelp.mousePressed(()=>{
    showDebug = !showDebug;
    if (showDebug === true) {
      label.show();
    } else {
      label.hide();
    }
  });
  btnHelp.mouseOver(()=>helpInfo.show());
  btnHelp.mouseOut(()=>helpInfo.hide());
  fadeout(title);
  // game state
  curTar = 0;
  gameInfo = createDiv(tarList[curTar]);
  gameInfo.id('gameInfo');
  gameInfo.style('font-family', 'Helvetica');
  gameInfo.style('color','#ffffff');
  gameInfo.center();
  gameInfo.style('top', '0px');
  gameInfo.style('font-size','4.5em');
  gameInfo.style('text-shadow: 0px 0px 3px rgba(0,153,255,.4)')
  gameInfo.style('user-select: none');

  // fisrt classfy
  classify();
  confi = 0;
  resetImgBuffers();
}

// Serial ///////////////////////////////////////

async function serialWriteImageData(image) {
  if (serial.isOpen()) {
    // compress and write
    // 64 * 64  = 4096b = 1024 C (a-(a+15))
    // serial.write('z');
    for (var i = 0; i < 64 * 64; i+=4) {
      var n = 0;
      for (var j = 0; j < 4; j++) {
        n |= (image.pixels[(i+j)*4] === 255) * (1 << j);
      }
      serial.write(String.fromCharCode(97+n));
    }
  }
}

async function onButtonConnectToSerialDevice() {
  if (!serial.isOpen()) {
    await serial.connectAndOpen();
  }
}

function onSerialConnectionOpened(eventSender) {
  useSerial = true;
}

function onSerialConnectionClosed(eventSender) {
  useSerial = false;
}

function onSerialDataReceived(eventSender, newData) {
  recQueue.push(newData);
}

function onSerialErrorOccurred(eventSender, error) {
  console.log("onSerialErrorOccurred", error);
}

// HELPER ////////////////////

function windowResized(){
  setWinSize()
  resizeCanvas(windowWidth, windowHeight);
  pg3d.resizeCanvas(windowWidth, windowHeight);
}

function setWinSize() {
  w3d = windowWidth;
  h3d = windowHeight;
}

function fadeout(elm) {
  var tgt = document.getElementById(elm.id());
  var fade = setInterval(function () {
      if (!tgt.style.opacity) {
          tgt.style.opacity = 1;
      }
      if (tgt.style.opacity > 0) {
          tgt.style.opacity -= 0.1;
      } else {
          clearInterval(fade);
          elm.hide();
          isGame = true;
      }
  }, 50);
}