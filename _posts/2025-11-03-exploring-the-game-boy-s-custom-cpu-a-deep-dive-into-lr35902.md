---
layout: post
title: "Exploring the Game Boy's Custom CPU: A Deep Dive into LR35902"
subtitle: "Understanding and Programming the Game Boy’s Hybrid Processor"
tags: [emulation, Game Boy, CPU, programming, retro computing]
author: Lester Knight Chaykin
comments: true
mathjax: false
readtime: true
date: 2025-11-03 13:22:21 +0000
cover-img: /assets/img/posts/exploring-the-game-boy-s-custom-cpu-a-deep-dive-into-lr35902.jpg
thumbnail-img: /assets/img/posts/exploring-the-game-boy-s-custom-cpu-a-deep-dive-into-lr35902.jpg
share-img: /assets/img/posts/exploring-the-game-boy-s-custom-cpu-a-deep-dive-into-lr35902.jpg
---

## Introduction

The Nintendo Game Boy, a handheld gaming console released in 1989, is powered by a unique processor known as the LR35902. This CPU is a hybrid, combining features from both the Intel 8080 and the Zilog Z80, making it a fascinating subject for emulation enthusiasts and retro computing researchers. This blog post delves into the architecture, instruction set, and programming nuances of the LR35902, accompanied by practical examples and a simple emulation scenario.

## CPU Architecture

The LR35902 operates at a modest 4.19 MHz and features an 8-bit architecture similar to the Z80, but with fewer registers and simplified interrupt handling, resembling the 8080. It supports a modified Harvard architecture with separate spaces for program code and data, facilitating efficient instruction execution and data handling.

### Key Features

- **Clock Speed:** 4.19 MHz
- **Data Bus:** 8-bit
- **Address Bus:** 16-bit, capable of addressing 64KB of memory
- **Registers:** A, B, C, D, E, H, L, F (flags), and two index registers (SP, PC)
- **Interrupts:** V-Blank, LCD Stat, Timer, Serial, and Joypad

## Instruction Set and Programming

The instruction set of the LR35902 is a subset of the Z80’s, with additional instructions for controlling the Game Boy’s hardware like the graphics and sound modules. Below is an example of a simple assembly program that fills the screen with a solid color.

```assembly
; Fill the screen with a solid color
LD HL, 0x9800  ; Start of video RAM
LD B, 0x1F     ; Height of the screen (in tiles)
fill_loop:
    LD C, 0x1F ; Width of the screen (in tiles)
    row_loop:
        LD (HL), A ; Set current tile to the value in A
        INC HL
        DEC C
        JR NZ, row_loop
    DEC B
    JR NZ, fill_loop
    RET
```

This program uses the Game Boy’s video RAM starting at `0x9800` and fills it with the tile value stored in register `A` across the entire display.

## Emulating the LR35902

Emulating the LR35902 requires understanding its unique quirks, such as the memory banking system known as Memory Bank Controllers (MBCs), which are used to expand the accessible memory space beyond the 64KB limit.

### Emulator Skeleton in C

Here’s a basic structure of an LR35902 emulator in C, focusing on implementing the main CPU loop and a couple of instructions.

```c
#include <stdint.h>

typedef struct {
    uint8_t a, b, c, d, e, h, l, f;
    uint16_t sp, pc;
    uint8_t memory[65536];
} LR35902;

void execute_instruction(LR35902 *cpu) {
    uint8_t opcode = cpu->memory[cpu->pc++];
    switch (opcode) {
        case 0x77:  // LD (HL), A
            cpu->memory[(cpu->h << 8) | cpu->l] = cpu->a;
            break;
        case 0x04:  // INC B
            cpu->b++;
            break;
        // Add more opcodes as needed
    }
}

int main() {
    LR35902 cpu = {0};
    // Load a program into memory
    // Set initial register values

    while (1) {
        execute_instruction(&cpu);
    }

    return 0;
}
```

## Debugging and Challenges

Emulating the LR35902 involves various challenges, including accurately timing instructions and interrupts, and handling the Game Boy’s proprietary features like the Picture Processing Unit (PPU) for rendering graphics. Debugging requires careful testing against known good ROMs and extensive logging of CPU state changes.

## Conclusion

The Game Boy’s LR35902 processor offers a unique window into the world of hybrid CPU architectures. By studying and emulating this processor, we gain insights not only into the Game Boy’s operation but also into effective techniques for CPU design and emulation. This exploration can serve as a foundation for more complex emulation projects or as an educational tool for those interested in the inner workings of classic gaming consoles.