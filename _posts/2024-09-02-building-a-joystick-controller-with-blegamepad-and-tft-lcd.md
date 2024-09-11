---
layout: post
title: Building a Joystick Controller with BleGamepad and TFT LCD
subtitle: A DIY Bluetooth Game Controller using ESP32, Joystick, and TFT Display
tags: [ESP32, Bluetooth, Gamepad, TFT, IoT, Embedded Systems]
author: Lester Knight Chaykin
comments: true
---

{: .box-success}
In this project, we will create a custom joystick controller using the **ESP32**, **BleGamepad** library for Bluetooth functionality, and a **TFT LCD** for real-time feedback on joystick movements and button presses. The controller will act as a Bluetooth gamepad that can be used for gaming or other control applications.

## Components Used

- **ESP32 Dev Board**: The main microcontroller that handles joystick inputs and Bluetooth communication.
- **TFT LCD Display**: Displays real-time feedback for joystick position and button states.
- **Joystick Module**: For directional input.
- **Buttons**: Extra buttons for game control (e.g., triggers or action buttons).
- **BleGamepad Library**: Provides the BLE gamepad interface for Bluetooth communication.
- **TFT_eSPI Library**: Controls the TFT display to show the joystick's movements and states.

### Wiring Diagram

| Component         | ESP32 Pin  |
|-------------------|------------|
| Joystick X-Axis    | A0         |
| Joystick Y-Axis    | A1         |
| Joystick Button    | GPIO 34    |
| Button 1           | GPIO 32    |
| Button 2           | GPIO 33    |
| TFT LCD (SPI)      | Standard SPI Pins (MISO, MOSI, SCK) |
| TFT DC/CS/RESET    | Custom GPIO Pins (e.g., GPIO 16, 17, 18) |

## Code Overview

We will divide the code into different sections: setting up the **BleGamepad**, reading the **joystick input**, displaying data on the **TFT screen**, and handling **button presses**.

### Including Libraries

We’ll start by including the necessary libraries for the project:

```cpp
#include <BleGamepad.h>
#include <TFT_eSPI.h>
#include <SPI.h>
```

- **BleGamepad**: Handles BLE communication, allowing the ESP32 to act as a Bluetooth game controller.
- **TFT_eSPI**: Manages the TFT display.

### Global Variables

Define the gamepad object, TFT object, and joystick/button variables:

```cpp
BleGamepad bleGamepad("ESP32 Controller", "Another World", 100); // Custom name and manufacturer
TFT_eSPI tft = TFT_eSPI();

int joyX = 0;
int joyY = 0;
int joyButtonState = 0;
int button1State = 0;
int button2State = 0;

#define JOY_X_PIN A0
#define JOY_Y_PIN A1
#define JOY_BUTTON_PIN 34
#define BUTTON_1_PIN 32
#define BUTTON_2_PIN 33
```

### Setup Function

In the setup, we initialize the **TFT display**, **BleGamepad**, and configure the **input pins**:

```cpp
void setup() {
  Serial.begin(115200);

  // Initialize TFT display
  tft.init();
  tft.setRotation(1);
  tft.fillScreen(TFT_BLACK);

  // Initialize BLE Gamepad
  bleGamepad.begin();

  // Configure input pins
  pinMode(JOY_BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUTTON_1_PIN, INPUT_PULLUP);
  pinMode(BUTTON_2_PIN, INPUT_PULLUP);
  
  tft.setTextColor(TFT_WHITE);
  tft.setTextSize(2);
  tft.setCursor(0, 0);
  tft.println("Controller Ready");
}
```

### Loop Function

The **loop** function handles reading joystick and button states, sending them over Bluetooth, and updating the TFT display:

```cpp
void loop() {
  // Read joystick analog values
  joyX = analogRead(JOY_X_PIN);
  joyY = analogRead(JOY_Y_PIN);

  // Map the analog values to gamepad range (-32767 to 32767)
  int mappedJoyX = map(joyX, 0, 4095, -32767, 32767);
  int mappedJoyY = map(joyY, 0, 4095, -32767, 32767);

  // Read button states
  joyButtonState = digitalRead(JOY_BUTTON_PIN);
  button1State = digitalRead(BUTTON_1_PIN);
  button2State = digitalRead(BUTTON_2_PIN);

  // Update the gamepad joystick and button state
  bleGamepad.setAxes(mappedJoyX, mappedJoyY, 0, 0, 0, 0);  // X, Y axes
  bleGamepad.press(joyButtonState == LOW ? BUTTON_1 : 0);   // Joystick button
  bleGamepad.press(button1State == LOW ? BUTTON_2 : 0);     // Button 1
  bleGamepad.press(button2State == LOW ? BUTTON_3 : 0);     // Button 2
  
  // Display joystick values on the TFT screen
  tft.fillScreen(TFT_BLACK);
  tft.setCursor(0, 0);
  tft.printf("X: %d\n", mappedJoyX);
  tft.printf("Y: %d\n", mappedJoyY);
  
  // Display button states
  tft.printf("Joy Btn: %s\n", joyButtonState == LOW ? "Pressed" : "Released");
  tft.printf("Btn 1: %s\n", button1State == LOW ? "Pressed" : "Released");
  tft.printf("Btn 2: %s\n", button2State == LOW ? "Pressed" : "Released");
  
  // Send data via BLE
  bleGamepad.sendReport();

  delay(100);  // Update rate
}
```

### Explanation of Key Functions

- **`bleGamepad.setAxes()`**: Updates the joystick positions. The `map` function converts the joystick’s analog values (0 to 4095) into the gamepad range (-32767 to 32767).
- **`bleGamepad.press()`**: Sends the button press to the connected device. Multiple buttons can be pressed simultaneously by specifying different button numbers (e.g., `BUTTON_1`, `BUTTON_2`, etc.).
- **TFT Display Update**: The TFT screen shows the current joystick values and button states.

### Full Code Example

Here’s the complete code for the joystick controller project:

```cpp
#include <BleGamepad.h>
#include <TFT_eSPI.h>
#include <SPI.h>

BleGamepad bleGamepad("ESP32 Controller", "Another World", 100); // Gamepad name and manufacturer
TFT_eSPI tft = TFT_eSPI();

int joyX = 0;
int joyY = 0;
int joyButtonState = 0;
int button1State = 0;
int button2State = 0;

#define JOY_X_PIN A0
#define JOY_Y_PIN A1
#define JOY_BUTTON_PIN 34
#define BUTTON_1_PIN 32
#define BUTTON_2_PIN 33

void setup() {
  Serial.begin(115200);
  
  tft.init();
  tft.setRotation(1);
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE);
  tft.setTextSize(2);
  tft.setCursor(0, 0);
  tft.println("Controller Ready");

  bleGamepad.begin();

  pinMode(JOY_BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUTTON_1_PIN, INPUT_PULLUP);
  pinMode(BUTTON_2_PIN, INPUT_PULLUP);
}

void loop() {
  joyX = analogRead(JOY_X_PIN);
  joyY = analogRead(JOY_Y_PIN);

  int mappedJoyX = map(joyX, 0, 4095, -32767, 32767);
  int mappedJoyY = map(joyY, 0, 4095, -32767, 32767);

  joyButtonState = digitalRead(JOY_BUTTON_PIN);
  button1State = digitalRead(BUTTON_1_PIN);
  button2State = digitalRead(BUTTON_2_PIN);

  bleGamepad.setAxes(mappedJoyX, mappedJoyY, 0, 0, 0, 0);
  bleGamepad.press(joyButtonState == LOW ? BUTTON_1 : 0);
  bleGamepad.press(button1State == LOW ? BUTTON_2 : 0);
  bleGamepad.press(button2State == LOW ? BUTTON_3 : 0);

  tft.fillScreen(TFT_BLACK);
  tft.setCursor(0, 0);
  tft.printf("X: %d\n", mappedJoyX);
  tft.printf("Y: %d\n", mappedJoyY);
  tft.printf("Joy Btn: %s\n", joyButtonState == LOW ? "Pressed" : "Released");
  tft.printf("Btn 1: %s\n", button1State == LOW ? "Pressed" : "Released");
  tft.printf("Btn 2: %s\n", button2State == LOW ? "Pressed" : "Released");

  bleGamepad.sendReport();
  delay(100);
}
```

## Conclusion

This project demonstrates how to create a Bluetooth game controller using the ESP32, a joystick, and a TFT display. The BleGamepad library allows the ESP32 to act as a Bluetooth game controller that can communicate with devices like PCs or smartphones. The joystick inputs and button presses are sent via Bluetooth, while the TFT display provides real-time feedback on the controller’s state.

With this setup, you can extend the project by adding more buttons, refining the display interface, or even creating custom game profiles for different games. Whether for gaming or controlling other applications, this DIY joystick controller opens up a wide range of possibilities for your Bluetooth-enabled projects.
