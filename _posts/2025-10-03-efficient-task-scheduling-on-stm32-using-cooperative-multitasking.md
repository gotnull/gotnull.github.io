---
layout: post
title: "Efficient Task Scheduling on STM32 Using Cooperative Multitasking"
subtitle: "Implementing a lightweight scheduler for real-time applications"
tags: [embedded, STM32, microcontroller, programming, real-time]
author: Lester Knight Chaykin
comments: true
mathjax: false
readtime: true
date: 2025-10-03 13:19:11 +0000
cover-img: /assets/img/posts/efficient-task-scheduling-on-stm32-using-cooperative-multitasking.jpg
thumbnail-img: /assets/img/posts/efficient-task-scheduling-on-stm32-using-cooperative-multitasking.jpg
share-img: /assets/img/posts/efficient-task-scheduling-on-stm32-using-cooperative-multitasking.jpg
---

In this blog post, we'll dive deep into the implementation of a cooperative multitasking scheduler for STM32 microcontrollers. Cooperative multitasking, unlike preemptive multitasking, relies on the tasks themselves to yield control periodically, making it particularly suitable for real-time applications where predictable execution is crucial. We'll explore the design, implementation, and debugging of a lightweight scheduler capable of managing multiple tasks efficiently.

## Introduction

Multitasking on microcontrollers allows applications to perform multiple operations seemingly simultaneously, increasing the efficiency and responsiveness of embedded systems. In cooperative multitasking, each task periodically yields control back to the scheduler, which then decides which task to run next. This mechanism ensures that tasks are well-coordinated and that critical tasks receive the necessary processor time.

## System Requirements

- **Microcontroller**: STM32F103C8T6
- **Development Environment**: STM32CubeIDE
- **Programming Language**: C

## Scheduler Design

The scheduler is designed to manage various tasks based on their priorities and states. Each task is represented by a function pointer and associated metadata such as its state, priority, and next run time.

### Task Structure

Here's a simple structure to represent a task:

```c
typedef enum {
    TASK_READY,
    TASK_RUNNING,
    TASK_WAITING,
    TASK_SUSPENDED
} TaskState;

typedef struct {
    void (*run)(void*);  // Task function
    void* params;        // Parameters for the task function
    uint32_t period;     // Time between runs in ticks
    uint32_t nextRunTime; // System tick when the task should run next
    TaskState state;      // Current state of the task
} Task;
```

### Scheduler Initialization and Task Management

The scheduler initializes tasks and manages their execution based on system ticks.

```c
#define MAX_TASKS 10
Task taskArray[MAX_TASKS];
int taskCount = 0;

void Scheduler_Init(void) {
    memset(taskArray, 0, sizeof(taskArray));
    taskCount = 0;
}

void Scheduler_AddTask(Task task) {
    if (taskCount < MAX_TASKS) {
        taskArray[taskCount++] = task;
    }
}

void Scheduler_Run(void) {
    while(1) {
        for (int i = 0; i < taskCount; i++) {
            Task* task = &taskArray[i];
            if (task->state == TASK_READY && task->nextRunTime <= HAL_GetTick()) {
                task->state = TASK_RUNNING;
                task->run(task->params);
                task->nextRunTime = HAL_GetTick() + task->period;
                task->state = TASK_READY;
            }
        }
    }
}
```

## Task Implementation

Each task should be designed to perform its function quickly and yield control back to the scheduler.

```c
void BlinkLED(void* params) {
    HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_13);  // Toggle LED on STM32F103 board
}
```

## Adding Tasks to Scheduler

```c
int main(void) {
    HAL_Init();
    Scheduler_Init();

    Task blinkTask = {
        .run = BlinkLED,
        .period = 1000, // Run every 1000 ms
    };

    Scheduler_AddTask(blinkTask);
    Scheduler_Run();
}
```

## Debugging and Optimization

Throughout the development, use debugging tools available in STM32CubeIDE to step through the scheduler and task code. Monitor the CPU usage and optimize tasks to minimize their execution time to prevent task starvation.

## Conclusion

Implementing a cooperative scheduler on an STM32 microcontroller provides an efficient way to manage multiple tasks without the overhead of an RTOS. It's crucial for tasks to be well-optimized and for the scheduler to be robust enough to handle various task loads. This approach is particularly useful in systems where control over task execution order and timing is critical.

In the next post, we'll explore adding features such as task priorities and dynamic task creation and deletion, further enhancing our simple scheduler's capabilities.