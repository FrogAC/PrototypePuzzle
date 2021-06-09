#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128 // OLED display width, in pixels
#define SCREEN_HEIGHT 64 // OLED display height, in pixels

// Declaration for an SSD1306 display connected to I2C (SDA, SCL pins)
#define OLED_RESET     4 // Reset pin # (or -1 if sharing Arduino reset pin)
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

const int IN_POT = A5;
const int IN_Z = 15;
const int IN_X = 32;

unsigned long currMs;
unsigned long prevMs;

void setup() {
  Serial.begin(115200);

  // SSD1306_SWITCHCAPVCC = generate display voltage from 3.3V internally
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3D)) { // Address 0x3D for 128x64
    Serial.println(F("SSD1306 allocation failed"));
    for (;;); // Don't proceed, loop forever
  }

  pinMode(IN_POT, INPUT);
  pinMode(IN_Z, INPUT_PULLUP);
  pinMode(IN_X, INPUT_PULLUP);

  currMs = prevMs = millis();
  display.clearDisplay();
}

int prevPot = -1;
unsigned long prevRender = 0;
int i = 0;
void loop(){
  if ((currMs = millis()) - prevMs < (1000 / 60)) return;
  float timeDelta = (float)(currMs - prevMs) / 200.;
  prevMs = currMs;
      
  int pot = analogRead(IN_POT);
  if (abs(pot - prevPot) > 20)
    Serial.println(pot);
  prevPot = pot;

  if (isButtonClicked(IN_Z)) {
      Serial.println('Z');
  }

  if (isButtonClicked(IN_X)) {
      Serial.println('X');
  }

  ////////////////////////


  if (currMs - prevRender > 300) {
    if(Serial.available() > 0){
      if (i == 0) {
        display.clearDisplay();
        // while(Serial.available() > 0) Serial.readStringUntil('z');
      }
      prevRender = currMs;
      String s = Serial.readString(); 
      for (char c : s) {
        c = c - 97;
        display.drawPixel(32+i%64, i/64, (c & 0b0001) > 0 ? BLACK : WHITE);
        display.drawPixel(32+i%64+1, i/64, (c & 0b0010) > 0 ? BLACK : WHITE);
        display.drawPixel(32+i%64+2, i/64, (c & 0b0100) > 0 ? BLACK : WHITE);
        display.drawPixel(32+i%64+3, i/64, (c & 0b1000) > 0 ?  BLACK : WHITE);
        i+=4;
        if (i == 64 *64) {
          i = 0;
        }
      }
      display.display();
    }
  }
                                   
}

unsigned long lastBtnMs = 0;
boolean isButtonClicked(int btnPin) {
  int val1 = digitalRead(btnPin);
  currMs = millis();

  if (val1 == LOW) {
    if (currMs - lastBtnMs < 1000) return false;
    currMs = lastBtnMs = millis();
    return true;
  }
  return false;
}