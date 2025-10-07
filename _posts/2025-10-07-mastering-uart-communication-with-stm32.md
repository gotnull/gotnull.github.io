---
layout: post
title: "Mastering UART Communication with STM32"
subtitle: "A deep dive into implementing UART communication for STM32 microcontrollers"
tags: [microcontroller, STM32, UART, embedded systems, programming]
author: Lester Knight Chaykin
comments: true
mathjax: false
readtime: true
date: 2025-10-07 13:21:28 +0000
cover-img: /assets/img/posts/mastering-uart-communication-with-stm32.jpg
thumbnail-img: /assets/img/posts/mastering-uart-communication-with-stm32.jpg
share-img: /assets/img/posts/mastering-uart-communication-with-stm32.jpg
---

UART (Universal Asynchronous Receiver/Transmitter) is a crucial communication protocol in embedded systems, particularly for STM32 microcontrollers. This post delves into the nuts and bolts of implementing UART communication, using the STM32 as a case study. We'll cover everything from setting up the hardware to the intricacies of the software implementation, providing a comprehensive guide on how to efficiently set up UART communication for your STM32 projects.

## Introduction

UART is a widely used protocol for serial communication between devices. It is particularly useful in scenarios where communication needs to occur at a moderate speed over short distances. In this post, we focus on the STM32 microcontroller, popular for its advanced capabilities and performance in industrial and commercial applications.

## Hardware Setup

For this demonstration, you'll need:
- STM32F103C8T6 microcontroller
- USB-to-serial adapter
- Jumper wires
- Breadboard

### Connection Diagram
Connect the STM32's TX pin to the RX pin of the USB-to-serial adapter and vice versa. Ground should be common between the STM32 and the adapter.

## Software Implementation

### Initialization

First, we need to set up the UART peripheral. This involves configuring the GPIO pins for UART functionality and setting the correct baud rate.

```c
#include "stm32f1xx_hal.h"

void UART_Init(void) {
    // Enable the clock for USART1 and GPIOA
    __HAL_RCC_USART1_CLK_ENABLE();
    __HAL_RCC_GPIOA_CLK_ENABLE();

    GPIO_InitTypeDef GPIO_InitStruct = {0};

    // UART TX on PA9
    GPIO_InitStruct.Pin = GPIO_PIN_9;
    GPIO_InitStruct.Mode = GPIO_MODE_AF_PP;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_HIGH;
    HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);

    // UART RX on PA10
    GPIO_InitStruct.Pin = GPIO_PIN_10;
    GPIO_InitStruct.Mode = GPIO_MODE_INPUT;
    GPIO_InitStruct.Pull = GPIO_NOPULL;
    HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);

    USART_HandleTypeDef huart1;
    huart1.Instance = USART1;
    huart1.Init.BaudRate = 9600;
    huart1.Init.WordLength = USART_WORDLENGTH_8B;
    huart1.Init.StopBits = USART_STOPBITS_1;
    huart1.Init.Parity = USART_PARITY_NONE;
    huart1.Init.Mode = USART_MODE_TX_RX;
    huart1.Init.HwFlowCtl = USART_HWCONTROL_NONE;
    HAL_UART_Init(&huart1);
}
```

### Sending Data

To send data via UART, use the following function:

```c
void UART_SendString(char* str) {
    while(*str) {
        USART1->DR = (*str++ & (uint8_t)0xFF);
        while(!(USART1->SR & USART_SR_TXE));
    }
}
```

## Debugging

During the implementation, you might encounter issues such as incorrect baud rate settings or misconfigured GPIO pins. Utilize tools like a logic analyzer to monitor the UART lines and ensure that the transmitted data matches what is expected.

## Results and Conclusion

By setting up and programming the STM32 for UART communication, you enable a robust channel for serial data exchange. This setup can serve as a foundation for more complex projects, such as telemetry systems or microcontroller-to-PC communication.

Remember that each microcontroller might have slightly different configurations, so always refer to the specific reference manual and datasheets for your device.

In upcoming posts, we'll explore other communication protocols and delve into more advanced uses of the STM32 microcontroller. Stay tuned for more insights and practical guides!