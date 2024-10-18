---
layout: post  
title: Building a Gameboy Color Emulator: CPU Execution and Memory Management  
subtitle: Diving Into CPU Instructions, Timers, and Memory Mapping  
tags: [Gameboy Color, GBC, emulator, CPU, memory, instructions]  
author: Lester Knight Chaykin  
comments: true  
---

{: .box-success}  
In this post, we will dive deeper into how the CPU processes instructions in the Gameboy Color emulator, how timing is managed, and the intricacies of memory mapping. Now that we’ve set up the emulator and mapped the inputs, we’ll focus on the core components that make the emulation work—specifically, how the CPU fetches and executes instructions and how the memory is structured.

## CPU Instruction Execution

The CPU is the heart of any emulator, and emulating its behavior accurately is essential for running ROMs correctly. In our emulator, we use the `cpu.dart` file to handle the **fetch-execute cycle**. This is the process where the CPU fetches an instruction from memory, decodes it, and then executes it.

### Fetch-Execute Cycle

When the CPU runs, it continuously cycles through the following stages:

1. **Fetch**: The CPU retrieves the next instruction from memory at the address stored in the Program Counter (PC).
2. **Decode**: The instruction is decoded to determine what operation needs to be performed.
3. **Execute**: The CPU performs the operation, which may involve manipulating registers, interacting with memory, or performing arithmetic/logic operations.

### Sample CPU Instruction Execution (LD A, B)

Here's a simplified example of how we implement the `LD A, B` instruction (which loads the value of register B into register A):

```dart  
void executeInstruction(int opcode) {  
  switch (opcode) {  
    case 0x78:  
      // LD A, B: Copy the value from register B into register A
      registers.a = registers.b;  
      break;  
    // Additional instructions would go here...
  }  
}  
```

In this example, the opcode `0x78` represents the `LD A, B` instruction. The emulator fetches this opcode from memory, decodes it, and then executes it by copying the value in the `B` register into the `A` register.

### Handling Complex Instructions

For more complex instructions like jumps or stack manipulation (e.g., `JP` or `CALL`), the CPU must interact with memory or other registers. Here's a simplified example of handling a jump:

```dart  
case 0xC3:  // JP nn (Jump to a 16-bit address)
  registers.pc = memory.read16Bit(registers.pc);  
  break;  
```

This instruction causes the CPU to jump to a specific 16-bit address. It fetches the address from memory and updates the Program Counter (PC) to point to that address.

## Timing and Cycle Management

Emulating the **timing** of instructions is crucial for ensuring that the games run at the correct speed. Each instruction takes a certain number of CPU cycles to complete. In our emulator, we track cycles and use them to synchronize the CPU with other components (like the display and timers).

### Managing Cycles

Each time an instruction is executed, it consumes a number of CPU cycles. This timing information is critical because the Gameboy’s hardware (e.g., display and timers) operates based on these cycles.

For example, the `LD A, B` instruction takes 4 cycles, while more complex instructions like `CALL` or `JP` take more cycles. Here's an example of how we manage cycles:

```dart  
int cycles = 0;

void executeInstruction(int opcode) {  
  switch (opcode) {  
    case 0x78:  
      registers.a = registers.b;  
      cycles += 4;  // LD A, B takes 4 cycles  
      break;

    case 0xC3:  // JP nn (Jump)
      registers.pc = memory.read16Bit(registers.pc);  
      cycles += 12;  // JP nn takes 12 cycles  
      break;
  }  
}  
```

## Memory Management

The Gameboy Color has a 16-bit address space, meaning it can address up to 65,536 bytes of memory. This memory is divided into several regions, such as ROM, RAM, video memory (VRAM), and hardware registers.

### Memory Map Overview

The memory map for the Gameboy Color looks something like this:

- **0x0000 - 0x3FFF**: ROM (Bank 0)
- **0x4000 - 0x7FFF**: ROM (Bank 1)
- **0x8000 - 0x9FFF**: Video RAM (VRAM)
- **0xA000 - 0xBFFF**: External RAM (used by certain cartridges)
- **0xC000 - 0xDFFF**: Working RAM (WRAM)
- **0xFF00 - 0xFF7F**: Hardware I/O registers
- **0xFF80 - 0xFFFF**: High RAM (HRAM)

### Memory Read/Write Operations

Reading and writing memory is crucial for the emulator's operation, especially for loading ROM data and interacting with hardware. Here’s a simplified example of reading from memory:

```dart  
int readMemory(int address) {  
  if (address < 0x8000) {  
    // Reading from ROM
    return rom[address];  
  } else if (address >= 0x8000 && address < 0xA000) {  
    // Reading from VRAM
    return vram[address - 0x8000];  
  } else if (address >= 0xA000 && address < 0xC000) {  
    // Reading from external RAM
    return externalRam[address - 0xA000];  
  }  
  // Additional memory regions...
  return 0xFF;  // Default return value  
}  
```

### Writing to Memory

Similarly, writing to memory involves checking the address and determining which memory region is being written to:

```dart  
void writeMemory(int address, int value) {  
  if (address >= 0x8000 && address < 0xA000) {  
    // Writing to VRAM
    vram[address - 0x8000] = value;  
  } else if (address >= 0xA000 && address < 0xC000) {  
    // Writing to external RAM
    externalRam[address - 0xA000] = value;  
  }  
  // Additional memory regions...
}  
```

## Conclusion

In this post, we’ve explored the intricacies of CPU instruction execution, timing management, and memory mapping within our Gameboy Color emulator. These core elements are essential for running games properly and ensuring that the emulator behaves as closely as possible to the real hardware.

Next, we will delve into **graphics rendering** and how to emulate the Gameboy’s display system.

If you have any questions or suggestions, feel free to leave a comment below!
