---
layout: post
title: "Exploring the Fundamentals of I2C Communication on the PIC Microcontroller"
subtitle: "A deep dive into implementing I2C protocol for sensor integration using PIC16F877"
tags: [embedded systems, microcontroller, I2C, PIC, sensor integration]
author: Lester Knight Chaykin
comments: true
mathjax: false
readtime: true
date: 2025-10-22 13:24:06 +0000
cover-img: /assets/img/posts/exploring-the-fundamentals-of-i2c-communication-on-the-pic-microcontroller.jpg
thumbnail-img: /assets/img/posts/exploring-the-fundamentals-of-i2c-communication-on-the-pic-microcontroller.jpg
share-img: /assets/img/posts/exploring-the-fundamentals-of-i2c-communication-on-the-pic-microcontroller.jpg
---

## Introduction

Inter-Integrated Circuit (I2C) is a vital communication protocol widely used in embedded systems for interfacing microcontrollers with various sensors and peripheral devices. In this blog post, we will explore the implementation of I2C communication using the PIC16F877 microcontroller. Our focus will be on connecting a temperature and humidity sensor, providing a practical guide from circuit setup to code implementation.

## Design

The PIC16F877 features a built-in MSSP (Master Synchronous Serial Port) module that supports I2C in both Master and Slave modes. For our project, the PIC16F877 will operate in Master mode.

### Circuit Setup

1. **Microcontroller**: PIC16F877.
2. **Sensor**: Generic I2C-compatible temperature and humidity sensor.
3. **Pull-up Resistors**: 4.7kΩ on both SDA and SCL lines.
4. **Connections**: SDA (Serial Data Line) and SCL (Serial Clock Line) connected to corresponding pins on the PIC.

Circuit schematic:

```
[ PIC16F877 ]---[ SDA ]---[ Sensor ]
                |
             [4.7kΩ]
                |
             [Vcc]

[ PIC16F877 ]---[ SCL ]---[ Sensor ]
                |
             [4.7kΩ]
                |
             [Vcc]
```

## Implementation

We will program the PIC16F877 using MPLAB X IDE and the XC8 compiler. The following code initializes the I2C module and reads data from the sensor.

```c
#include <xc.h>

#define _XTAL_FREQ 20000000  // 20 MHz Crystal

// I2C Master initialization
void I2C_Master_Init(const unsigned long c) {
    SSPCON = 0b00101000;  // SSP Module as Master
    SSPCON2 = 0x00;
    SSPADD = (_XTAL_FREQ / (4 * c)) - 1;  // Setting Clock Speed
    SSPSTAT = 0x00;
    TRISC3 = 1;  // Setting SCL and SDA as input
    TRISC4 = 1;
}

// I2C Wait Ready
void I2C_Wait() {
    while ((SSPCON2 & 0x1F) || (SSPSTAT & 0x04));  // Wait for idle and ready status
}

// I2C Start
void I2C_Start() {
    I2C_Wait();
    SEN = 1;  // Initiate start condition
}

// I2C Read
unsigned char I2C_Read(unsigned char ack) {
    unsigned char received;
    I2C_Wait();
    RCEN = 1;
    I2C_Wait();
    received = SSPBUF;  // Receive data
    I2C_Wait();
    ACKDT = (ack) ? 0 : 1;  // Acknowledge bit
    ACKEN = 1;  // Acknowledge sequence
    return received;
}

// Main Function
void main() {
    I2C_Master_Init(100000);  // Initialize I2C Master with 100kHz clock
    I2C_Start();  // Start I2C communication

    // Device address and read temperature
    I2C_Write(0x90);  // Device address
    unsigned char temperature = I2C_Read(0);  // Read temperature
    I2C_Stop();  // Stop I2C communication

    while (1) {
        // Application logic
    }
}
```

## Debugging

During implementation, you might encounter common issues such as no acknowledgment received from the sensor or incorrect readings. To debug:

1. **Check Connections**: Ensure all hardware connections are secure.
2. **Logic Analyzer**: Use a logic analyzer to trace the SDA and SCL lines for proper signaling.
3. **Pull-up Resistors**: Verify the values; sometimes different environmental conditions require adjustment of resistor values.

## Results and Conclusion

Upon successful implementation, the PIC16F877 reads temperature and humidity data transmitted by the sensor over I2C. This setup demonstrates the effectiveness of PIC microcontrollers in managing communication with peripheral devices, making it suitable for a wide range of applications in embedded systems.

In this tutorial, we've walked through setting up an I2C communication on a PIC16F877, from circuit design to programming and debugging. This example acts as a foundation for integrating more complex devices and sensors, pushing the boundaries of what can be achieved with microcontrollers in embedded systems.