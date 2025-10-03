---
layout: post
title: "Designing a Simple Cooperative Scheduler for Microcontrollers"
subtitle: "Implementing a lightweight multitasking environment on STM32"
tags: [embedded systems, microcontroller, STM32, programming, C]
author: Lester Knight Chaykin
comments: true
mathjax: false
readtime: true
date: 2025-10-03 02:54:36 +0000
cover-img: /assets/img/posts/designing-a-simple-cooperative-scheduler-for-microcontrollers.jpg
thumbnail-img: /assets/img/posts/designing-a-simple-cooperative-scheduler-for-microcontrollers.jpg
share-img: /assets/img/posts/designing-a-simple-cooperative-scheduler-for-microcontrollers.jpg
---

Multitasking on microcontrollers traditionally implies either using a full-fledged operating system or handling everything with interrupts and flags. However, there's a middle ground through cooperative scheduling. In this post, we'll design and implement a simple cooperative scheduler for the STM32 microcontroller, focusing on balancing simplicity with functionality.

### Why Cooperative Scheduling?

Cooperative scheduling involves tasks voluntarily yielding control to a scheduler, which then decides what task to run next. This method is simpler and uses less memory compared to preemptive multitasking, making it ideal for resource-constrained devices like microcontrollers.

### System Design

The scheduler will manage multiple tasks without needing complex context switching or deep stacks. Each task is a function that executes part of its operation and then yields control back to the scheduler, which is efficient for tasks with non-blocking behavior.

### Implementation

We'll use the STM32F103C8 (Blue Pill) microcontroller for this example, programmed in C using the STM32 HAL library.

#### Task Definition and Scheduler Structure

```c
#include "stm32f1xx_hal.h"

typedef void (*TaskFunction)(void);  // Task function pointer type

typedef struct {
    TaskFunction run;
    uint32_t period;
    uint32_t lastRun;
} Task;

#define MAX_TASKS 5
Task tasks[MAX_TASKS];
int taskCount = 0;

void addTask(TaskFunction taskFunc, uint32_t period) {
    if (taskCount < MAX_TASKS) {
        tasks[taskCount].run = taskFunc;
        tasks[taskCount].period = period;
        tasks[taskCount].lastRun = HAL_GetTick();
        taskCount++;
    }
}
```

#### Scheduler Logic

```c
void schedule() {
    uint32_t currentTick = HAL_GetTick();
    for (int i = 0; i < taskCount; i++) {
        Task* task = &tasks[i];
        if ((currentTick - task->lastRun) >= task->period) {
            task->run();
            task->lastRun = currentTick;
        }
    }
}
```

#### Example Tasks

```c
void task1() {
    HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_13); // Toggle LED
}

void task2() {
    // Simulate a non-blocking delay
}

void setup() {
    HAL_Init();
    __HAL_RCC_GPIOC_CLK_ENABLE();
    GPIO_InitTypeDef GPIO_InitStruct = {0};
    GPIO_InitStruct.Pin = GPIO_PIN_13;
    GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(GPIOC, &GPIO_InitStruct);

    addTask(task1, 1000);  // Toggle LED every 1000 ms
    addTask(task2, 2000);  // Other task
}

int main() {
    setup();
    while (1) {
        schedule();
    }
}
```

### Debugging and Challenges

During development, ensuring tasks don't block the CPU for long was crucial. Debugging involved checking that each task adheres to its intended execution period and doesn't starve other tasks.

### Conclusion

The cooperative scheduler presented here is straightforward and effective for simple multitasking needs on microcontrollers like the STM32. It's particularly useful in scenarios where tasks are largely independent and don't require strict timing precision. This approach illustrates a balance between control and ease of programming, fitting perfectly within the resource constraints of embedded systems.

By implementing such a scheduler, developers can gain better control over program flow and timing, making their applications more reliable and maintainable.