---
layout: post
title: ESP32 Cellular Device and Code Breakdown
subtitle: A Deep Dive into Hardware and Software for IoT Applications
tags: [ESP32, IoT, embedded systems, MQTT, GPS]
author: Lester Knight Chaykin
comments: true
---

{: .box-success}
In this blog post, I will explore the details of my ESP32 project, including the device's hardware setup and a comprehensive overview of the code, header files, and libraries used. The project involves connecting the ESP32 to a GSM module, interfacing with a DHT sensor, and using MQTT for communication. Let’s break down the key components and explain how they fit together.

## Hardware Components

The project uses the following hardware components:
- **ESP32 Dev Board**: Handles the main logic and communication with peripherals.
- **SIM7000 GSM Module**: Provides network connectivity for MQTT communication and GPS data.
- **DHT22 Sensor**: Measures temperature and humidity.
- **Battery 18650**: Monitors the power levels of the system.
- **External Antenna**: For GPS and GSM connectivity.
- **Piezo Buzzer**: Provides audio alerts based on events.

### Antenna

The external antenna shown in the image is used for GSM and GPS. Ensure it operates within the required frequency bands for LTE (698-960/1710-2690 MHz). This antenna is compatible with my SIM7000 module and works for both GPS and GSM communication.

## Code Overview

The following sections break down the key parts of the code, explaining how each component fits into the project. 

### Header Files and Libraries

Here are the libraries and header files used in this project:

```cpp
#include <TinyGsmClient.h>
#include <ArduinoHttpClient.h>
#include <PubSubClient.h>
#include <Battery18650Stats.h>
#include "DHT.h"
```

- **TinyGsmClient**: Handles GSM and GPS communication.
- **PubSubClient**: Manages MQTT connections.
- **Battery18650Stats**: Monitors the battery voltage and charge levels.
- **DHT**: Used for interfacing with the DHT22 sensor.

### Global Variables

Several global variables are used to store device states and sensor readings:

```cpp
const char apn[] = "apn.wap";
const char* mqtt_broker = "broker.hivemq.com";
const int mqtt_port = 1883;
float latitude, longitude, speed, alt, accuracy;
int vsat, usat, year, month, day, hour, minute, second;
```

### Power Management Functions

These functions handle powering on and off the modem:

```cpp
void modemPowerOn() {
  pinMode(PWR_PIN, OUTPUT);
  digitalWrite(PWR_PIN, LOW);
  delay(1000);
  digitalWrite(PWR_PIN, HIGH);
}

void modemPowerOff() {
  pinMode(PWR_PIN, OUTPUT);
  digitalWrite(PWR_PIN, LOW);
  delay(1500);
  digitalWrite(PWR_PIN, HIGH);
}
```

### MQTT Setup and Communication

MQTT is used to send sensor data and status updates to the cloud. Here's the setup for the MQTT client:

```cpp
void setup() {
  SerialMon.begin(115200);
  initModem();
  enableGPS();
  dht.begin();
  
  mqtt.setServer(mqtt_broker, mqtt_port);
  mqtt.setKeepAlive(20);
  mqtt.setCallback(mqttCallback);
}
```

This function establishes the connection to the MQTT broker and sets up callbacks for incoming messages.

### GPS Data Handling

The following function enables GPS and retrieves location data:

```cpp
void enableGPS() {
  modem.sendAT("+SGPIO=0,4,1,1");
  modem.enableGPS();
}

void gps_loop() {
  if (modem.getGPS(&latitude, &longitude, &speed, &alt, &vsat, &usat, &accuracy, &year, &month, &day, &hour, &minute, &second)) {
    char gps_data[128];
    sprintf(gps_data, "{ \"latitude\": %f, \"longitude\": %f, \"speed\": %f }", latitude, longitude, speed);
    mqtt.publish("anotherworld/gps", gps_data);
  }
}
```

### DHT Sensor Data

We measure temperature and humidity using the DHT sensor:

```cpp
void dht_loop() {
  int h = round(dht.readHumidity());
  int t = round(dht.readTemperature());
  
  if (!(isnan(h) || isnan(t))) {
    char dht_data[64];
    sprintf(dht_data, "{ \"humidity\": %i, \"temp\": %i }", h, t);
    mqtt.publish("anotherworld/dht", dht_data);
  }
}
```

### Battery Monitoring

The battery voltage and charge level are sent via MQTT to monitor the power state of the device:

```cpp
void battery_info_loop() {
  char battery_data[64];
  snprintf(battery_data, sizeof(battery_data), "{ \"volts\": %f, \"charge\": %f }", battery.getBatteryVolts(), battery.getBatteryChargeLevel());
  mqtt.publish("anotherworld/battery", battery_data);
}
```

## Full Code Example

Here’s the full code for the project, bringing together all the pieces discussed above:

```cpp
#include <TinyGsmClient.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <Battery18650Stats.h>

// Define constants and variables...
void setup() {
  // Initialize modem, GPS, and sensors...
}

void loop() {
  // Main logic for MQTT, GPS, DHT, and battery data...
}

// Define functions for modem power, MQTT communication, sensor readings...
```

## Conclusion

This project demonstrates how to use the ESP32 with a GSM module to create an IoT device capable of sending sensor data and GPS coordinates via MQTT. The setup involves careful power management, sensor integration, and network communication, making it a great example of embedded systems in action.

If you have any questions or would like to see more details, feel free to leave a comment below!
