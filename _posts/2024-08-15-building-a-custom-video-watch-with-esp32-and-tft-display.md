---
layout: post
title: Building a Custom Video Watch with ESP32 and TFT Display
subtitle: A Wearable Video Streaming Device for the DIY Enthusiast
tags: [ESP32, video streaming, IoT, wearable tech, TFT display]
author: Lester Knight Chaykin
comments: true
---

{: .box-success}
In this project, we will build a custom video watch using an **ESP32**, a **TFT display**, and WiFi to stream video. This project involves setting up the ESP32 as a video receiver, displaying the stream on a small TFT screen, and packaging it into a wearable form factor. Whether for video playback or communication, this wearable video watch showcases the versatility of the ESP32 in IoT projects.

## Components Used

- **ESP32 Dev Board**: The heart of the project, handling video streaming and display.
- **TFT LCD Display**: A small screen to display video content.
- **WiFi Module**: Built-in on the ESP32, used to receive video streams over a network.
- **Battery (LiPo or 18650)**: Powers the watch for portable use.
- **3D-Printed Case**: Houses the components for wearable convenience.

## Project Overview

The custom video watch works by connecting to a WiFi network to stream video. The ESP32 fetches the video data from a server or an external source and renders it on the TFT screen. You can modify this project to support live video calls, video playback, or communication between multiple devices.

### Wiring Diagram

| Component       | ESP32 Pin  |
|-----------------|------------|
| TFT Display     | SPI Pins   |
| Display DC/CS   | Custom GPIO Pins |
| WiFi Antenna    | Integrated on ESP32 |
| Battery Input   | Power Input |

## Code Overview

We’ll break down the code into key sections: initializing the TFT display, setting up WiFi, and streaming video.

### Including Libraries

We need to include the following libraries to control the TFT display and manage WiFi:

xxxcpp
#include <TFT_eSPI.h>
#include <WiFi.h>
#include <HTTPClient.h>
xxx

- **TFT_eSPI**: Controls the TFT display.
- **WiFi**: Manages the ESP32’s WiFi connection.
- **HTTPClient**: Used to fetch the video stream over HTTP.

### Global Variables

We’ll define the WiFi credentials, the server URL for video streaming, and initialize the display:

xxxcpp
const char* ssid = "your_SSID";
const char* password = "your_password";
const char* videoStreamURL = "http://yourvideostream.com/stream";

TFT_eSPI tft = TFT_eSPI();  // Initialize TFT display
xxx

### Setup Function

In the setup, we initialize the WiFi connection and the TFT display:

xxxcpp
void setup() {
  Serial.begin(115200);
  
  // Initialize TFT display
  tft.init();
  tft.setRotation(1);  // Set appropriate rotation for watch
  tft.fillScreen(TFT_BLACK);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("Connected to WiFi!");
  
  // Ready the display
  tft.setTextColor(TFT_WHITE);
  tft.setTextSize(2);
  tft.setCursor(0, 0);
  tft.println("Video Watch Ready");
}
xxx

### Streaming Video

The following function fetches the video stream and renders it on the TFT display:

xxxcpp
void streamVideo() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(videoStreamURL);
    
    int httpCode = http.GET();
    if (httpCode > 0) {
      WiFiClient * stream = http.getStreamPtr();
      
      while (http.connected()) {
        while (stream->available()) {
          uint8_t buffer[512];
          int len = stream->readBytes(buffer, sizeof(buffer));
          
          // Render buffer to the TFT display
          tft.pushImage(0, 0, TFT_WIDTH, TFT_HEIGHT, (uint16_t*) buffer);
        }
      }
    }
    http.end();
  } else {
    Serial.println("WiFi not connected");
  }
}
xxx

### Main Loop

In the **loop** function, we continuously stream the video to the display:

xxxcpp
void loop() {
  streamVideo();  // Continuously stream video
}
xxx

### Full Code Example

Here’s the complete code for the custom video watch project:

xxxcpp
#include <TFT_eSPI.h>
#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "your_SSID";
const char* password = "your_password";
const char* videoStreamURL = "http://yourvideostream.com/stream";

TFT_eSPI tft = TFT_eSPI();

void setup() {
  Serial.begin(115200);
  
  tft.init();
  tft.setRotation(1);
  tft.fillScreen(TFT_BLACK);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("Connected to WiFi!");
  
  tft.setTextColor(TFT_WHITE);
  tft.setTextSize(2);
  tft.setCursor(0, 0);
  tft.println("Video Watch Ready");
}

void streamVideo() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(videoStreamURL);
    
    int httpCode = http.GET();
    if (httpCode > 0) {
      WiFiClient * stream = http.getStreamPtr();
      
      while (http.connected()) {
        while (stream->available()) {
          uint8_t buffer[512];
          int len = stream->readBytes(buffer, sizeof(buffer));
          tft.pushImage(0, 0, TFT_WIDTH, TFT_HEIGHT, (uint16_t*) buffer);
        }
      }
    }
    http.end();
  } else {
    Serial.println("WiFi not connected");
  }
}

void loop() {
  streamVideo();
}
xxx

## Conclusion

This project showcases the ESP32’s ability to stream video wirelessly and display it on a small TFT screen, making it a perfect fit for wearable tech like a custom video watch. Whether you want to watch a video, communicate with friends over a live stream, or use it as part of a more complex IoT setup, the ESP32’s flexibility enables endless possibilities.
