---
layout: post
title: "Exploring CAN Bus: Implementing a CAN Network on STM32"
subtitle: "A deep dive into setting up a Controller Area Network (CAN) with STM32 for automotive applications"
tags: [CAN, STM32, automotive, microcontroller, embedded systems]
author: Lester Knight Chaykin
comments: true
mathjax: false
readtime: true
date: 2025-10-24 13:22:39 +0000
cover-img: /assets/img/posts/exploring-can-bus-implementing-a-can-network-on-stm32.jpg
thumbnail-img: /assets/img/posts/exploring-can-bus-implementing-a-can-network-on-stm32.jpg
share-img: /assets/img/posts/exploring-can-bus-implementing-a-can-network-on-stm32.jpg
---

Controller Area Network (CAN) is pivotal in automotive and industrial applications due to its robustness and reliability in environments with high electromagnetic interference. In this post, I'll guide you through the process of setting up a CAN network using the STM32 microcontroller, which is favored for its advanced peripherals and performance in real-time applications.

## Introduction to CAN

The CAN protocol was designed to allow microcontrollers and devices to communicate with each other in applications without a host computer. It is a message-based protocol designed for multiplex electrical wiring within automobiles, which significantly reduces the complexity and weight of the wiring harness.

## Hardware Setup

For this tutorial, you'll need:
- 2 x STM32F103C8T6 Development Boards
- 2 x 120 ohm resistors
- 1 x CAN transceiver for each board (e.g., TJA1050)

### Circuit Diagram

Connect the CAN transceivers to the STM32 boards according to the following schematic:

```
[STM32] --- [TJA1050] --- [CAN_H, CAN_L] --- [TJA1050] --- [STM32]
```

Ensure each end of the CAN network has a 120-ohm terminator resistor between CAN_H and CAN_L.

## Programming the STM32 for CAN

### Configuration

Begin by configuring the CAN peripheral on the STM32. We'll set up the STM32 to operate in loopback mode for testing purposes.

```c
#include "stm32f1xx_hal.h"

void CAN_Config(void) {
    CAN_HandleTypeDef CanHandle;
    CAN_FilterConfTypeDef  sFilterConfig;
    static CanTxMsgTypeDef        TxMessage;
    static CanRxMsgTypeDef        RxMessage;

    CanHandle.Instance = CAN1;
    CanHandle.pTxMsg = &TxMessage;
    CanHandle.pRxMsg = &RxMessage;

    CanHandle.Init.TTCM = DISABLE;
    CanHandle.Init.ABOM = DISABLE;
    CanHandle.Init.AWUM = DISABLE;
    CanHandle.Init.NART = DISABLE;
    CanHandle.Init.RFLM = DISABLE;
    CanHandle.Init.TXFP = DISABLE;
    CanHandle.Init.Mode = CAN_MODE_LOOPBACK;
    CanHandle.Init.SJW = CAN_SJW_1TQ;
    CanHandle.Init.BS1 = CAN_BS1_6TQ;
    CanHandle.Init.BS2 = CAN_BS2_8TQ;
    CanHandle.Init.Prescaler = 4;

    if (HAL_CAN_Init(&CanHandle) != HAL_OK) {
        /* Initialization Error */
        Error_Handler();
    }
    
    /* Configure the CAN Filter */
    sFilterConfig.FilterNumber = 0;
    sFilterConfig.FilterMode = CAN_FILTERMODE_IDMASK;
    sFilterConfig.FilterScale = CAN_FILTERSCALE_32BIT;
    sFilterConfig.FilterIdHigh = 0x0000;
    sFilterConfig.FilterIdLow = 0x0000;
    sFilterConfig.FilterMaskIdHigh = 0x0000;
    sFilterConfig.FilterMaskIdLow = 0x0000;
    sFilterConfig.FilterFIFOAssignment = 0;
    sFilterConfig.FilterActivation = ENABLE;
    sFilterConfig.BankNumber = 14;

    if (HAL_CAN_ConfigFilter(&CanHandle, &sFilterConfig) != HAL_OK) {
        /* Filter configuration Error */
        Error_Handler();
    }
}
```

### Sending and Receiving Messages

The following function sends a CAN message and waits for its acknowledgment in loopback mode.

```c
void CAN_SendMessage(CAN_HandleTypeDef* CanHandle) {
    CanHandle->pTxMsg->StdId = 0x321;
    CanHandle->pTxMsg->RTR = CAN_RTR_DATA;
    CanHandle->pTxMsg->IDE = CAN_ID_STD;
    CanHandle->pTxMsg->DLC = 2;
    CanHandle->pTxMsg->Data[0] = 0xCA;
    CanHandle->pTxMsg->Data[1] = 0xFE;

    if (HAL_CAN_Transmit(CanHandle, 10) != HAL_OK) {
        /* Transmission Error */
        Error_Handler();
    }
}
```

## Debugging

During setup, ensure that the baud rate is matched on all devices. Mismatched baud rates are a common issue that can prevent communication. Use a logic analyzer to check the signals on the CAN bus if no messages are received.

## Results

After running the above code, you should be able to send and receive CAN messages between STM32 boards in loopback mode. This confirms that your hardware and software setups are correct.

## Conclusion

Setting up a CAN network with STM32 demonstrates the flexibility and power of microcontrollers in handling robust communication protocols. This tutorial serves as a foundation for more complex projects involving real-time vehicle communication systems or industrial automation.

For your next steps, try implementing a network with actual data transfer between multiple nodes and experiment with different message identifiers and filtering options to optimize your network's performance.