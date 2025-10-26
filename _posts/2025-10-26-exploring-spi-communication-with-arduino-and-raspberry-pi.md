---
layout: post
title: "Exploring SPI Communication with Arduino and Raspberry Pi"
subtitle: "A Practical Guide to Mastering SPI Between Two Popular Platforms"
tags: [SPI, Arduino, Raspberry Pi, electronics, programming]
author: Lester Knight Chaykin
comments: true
mathjax: false
readtime: true
date: 2025-10-26 13:18:26 +0000
cover-img: /assets/img/posts/exploring-spi-communication-with-arduino-and-raspberry-pi.jpg
thumbnail-img: /assets/img/posts/exploring-spi-communication-with-arduino-and-raspberry-pi.jpg
share-img: /assets/img/posts/exploring-spi-communication-with-arduino-and-raspberry-pi.jpg
---

## Introduction

Serial Peripheral Interface (SPI) is a widely used synchronous communication protocol that offers robust speed and flexibility, making it ideal for interfacing with various devices like sensors, memory chips, and microcontrollers. Today’s post dives into the practical implementation of SPI communication between an Arduino and a Raspberry Pi, which serves as a great learning platform for understanding the nuances of hardware interfacing and low-level programming.

## Design

SPI communication requires a master device and one or more slave devices. The Arduino will act as the slave in this setup, while the Raspberry Pi will be the master. This design choice allows us to leverage the Raspberry Pi's capacity to handle more complex processing tasks and the Arduino’s effectiveness in interfacing with hardware peripherals.

### Hardware Setup

- **Master (Raspberry Pi) Pins**:
  - MOSI (Master Out Slave In) → GPIO 10
  - MISO (Master In Slave Out) → GPIO 9
  - SCLK (Serial Clock) → GPIO 11
  - SS (Slave Select) → GPIO 8

- **Slave (Arduino) Pins**:
  - MOSI → Pin 11
  - MISO → Pin 12
  - SCLK → Pin 13
  - SS → Pin 10

### Software Configuration

Both devices need to be configured to use the same SPI settings:
- Clock polarity (CPOL)
- Clock phase (CPHA)
- Data bit order
- Baud rate

## Implementation

### Arduino Code (Slave)

```c
#include <SPI.h>

volatile byte receivedData;

void setup() {
  pinMode(SS, INPUT_PULLUP);
  SPI.begin();
  SPI.setClockDivider(SPI_CLOCK_DIV8);
  attachInterrupt(digitalPinToInterrupt(SS), selectSlave, FALLING);
  SPI.attachInterrupt();
}

ISR (SPI_STC_vect) {
  receivedData = SPDR;  // Capture data from SPI data register
}

void selectSlave() {
  SPDR = processData(receivedData);  // Prepare data for next transmission
}

byte processData(byte data) {
  // Process data and return response
  return data + 1;  // Example operation
}

void loop() {
  // Main loop does nothing, all work is done in ISR
}
```

### Raspberry Pi Code (Master)

```python
import spidev
import time

spi = spidev.SpiDev()
spi.open(0, 1)  # Open bus 0, device 1
spi.max_speed_hz = 500000
spi.mode = 0b00

try:
    while True:
        response = spi.xfer2([0x42])  # Send a byte and receive response
        print("Received:", response)
        time.sleep(1)
finally:
    spi.close()
```

## Debugging

During the initial tests, data consistency issues were encountered. It was determined that the problem was related to the slave select (SS) handling on the Arduino side. Adjusting the interrupt service routine to process the SS pin more reliably resolved the issue.

## Results and Conclusion

The described setup and code provide a robust framework for SPI communication between an Arduino and Raspberry Pi. This project not only enhances understanding of SPI but also demonstrates effective cross-platform communication. Through practical experimentation and problem-solving, significant insights were gained into both the hardware and software aspects of SPI, which are invaluable for any embedded systems engineer.