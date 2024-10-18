---
layout: post  
title: Building a Gameboy Color Emulator - I/O Registers and Save States  
subtitle: Handling Input/Output and Saving Game States  
tags: [Gameboy Color, GBC, emulator, input, I/O, save states]  
author: Lester Knight Chaykin  
comments: true  
---

{: .box-success}  
In this post, we’ll explore how to manage input/output (I/O) in the emulator, focusing on how the Gameboy Color interacts with buttons, timers, and hardware registers. We’ll also cover the implementation of **save states**, a feature that allows you to save and load game states at any point in time.

## Handling Input/Output Registers

The Gameboy Color interacts with the outside world (such as buttons, sound, and timers) via **I/O registers**. These registers are mapped to specific memory addresses between `0xFF00` and `0xFF7F`.

### Key I/O Registers

Here are some important I/O registers we need to handle in the emulator:
- **0xFF00 - P1**: Joypad input register, which tracks button presses.
- **0xFF04 - DIV**: Divider register, used for timing.
- **0xFF05 - TIMA**: Timer counter, incremented by the timer.
- **0xFF06 - TMA**: Timer modulo, which sets the value to which `TIMA` resets.
- **0xFF07 - TAC**: Timer control, controls the speed of the timer.

### Reading and Writing I/O Registers

When the CPU reads from or writes to these I/O registers, we need to intercept these operations and manage the state of the emulator’s hardware accordingly.

Here’s an example of how we handle reads and writes to the joypad input register (`P1`):

```dart  
int readIO(int address) {  
  switch (address) {  
    case 0xFF00:  // P1 register (joypad input)
      return readJoypadInput();  
    // Additional I/O registers...
    default:
      return 0xFF;  // Return default value if unhandled
  }  
}

void writeIO(int address, int value) {  
  switch (address) {  
    case 0xFF00:  // P1 register (joypad input)
      updateJoypadInput(value);  
      break;  
    // Additional I/O registers...
  }  
}
```

In this example:
- **readIO()** handles reading from an I/O register. For example, when the CPU reads from `0xFF00`, we return the current state of the buttons.
- **writeIO()** handles writing to I/O registers. For example, writing to `0xFF00` might change the current button input mode.

### Handling Joypad Input

The **P1 register** tracks the state of the joypad buttons. The Gameboy Color has two sets of buttons:
- **Directional buttons**: Up, Down, Left, Right.
- **Action buttons**: A, B, Start, Select.

Here’s how we read and update the joypad state:

```dart  
int joypadState = 0xFF;  // All buttons unpressed by default

int readJoypadInput() {  
  return joypadState;  // Return the current joypad state  
}

void updateJoypadInput(int value) {  
  // Update the joypad state based on the value written by the CPU  
  joypadState = value;  
}
```

- **joypadState** holds the current state of all buttons (1 means unpressed, 0 means pressed).
- **readJoypadInput()** returns the current state of the buttons when the CPU requests it.
- **updateJoypadInput()** modifies the joypad state based on button presses.

## Timers and Interrupts

Timers are essential for synchronizing events in the Gameboy Color, such as triggering interrupts or advancing the game logic. The Gameboy Color has a built-in timer that can trigger an interrupt when it overflows.

### Managing Timers

Here’s how we handle the timer registers (`DIV`, `TIMA`, `TMA`, and `TAC`):

```dart  
int div = 0;  // Divider register (0xFF04)
int tima = 0;  // Timer counter (0xFF05)
int tma = 0;  // Timer modulo (0xFF06)
int tac = 0;  // Timer control (0xFF07)

void updateTimers(int cycles) {  
  // Increment the divider register (DIV)
  div += cycles;  
  if (div >= 256) {  
    div = 0;  
    tima++;  // Increment TIMA when DIV overflows

    if (tima == 256) {  
      tima = tma;  // Reset TIMA to TMA when it overflows  
      requestInterrupt(TIMER_INTERRUPT);  
    }  
  }  
}
```

- **DIV** is incremented every CPU cycle and triggers updates to the **TIMA** counter.
- When **TIMA** overflows, it is reset to the value in **TMA**, and a **timer interrupt** is requested.

### Requesting Interrupts

When the timer overflows or when a button is pressed, the CPU needs to handle an interrupt. Here’s how we request an interrupt:

```dart  
void requestInterrupt(int interruptType) {  
  interruptFlag |= interruptType;  
}
```

This function sets the **interrupt flag** to notify the CPU that it needs to handle an event, such as a timer overflow or button press.

## Save and Load States

Save states allow players to save the exact state of the game and load it later. This involves saving the entire emulator state, including CPU registers, memory, and I/O states.

### Saving State

Here’s how we save the emulator state:

```dart  
class SaveState {  
  Uint8List memory;  
  int pc, sp, a, f, b, c, d, e, h, l;  // CPU registers  
  int div, tima, tma, tac;  // Timer registers  
  int joypadState;  // Joypad state
  // Other components (sound, video, etc.)

  SaveState(this.memory, this.pc, this.sp, this.a, this.f, this.b, this.c, this.d, this.e, this.h, this.l, this.div, this.tima, this.tma, this.tac, this.joypadState);
}

SaveState saveState() {  
  return SaveState(
    memory, registers.pc, registers.sp, registers.a, registers.f, registers.b, registers.c, registers.d, registers.e, registers.h, registers.l, div, tima, tma, tac, joypadState
  );  
}
```

- **SaveState** stores the entire state of the emulator, including memory, CPU registers, and I/O registers.
- **saveState()** captures the current state and stores it in a `SaveState` object.

### Loading State

To load a saved state, we simply restore all of the components to their previous values:

```dart  
void loadState(SaveState state) {  
  memory = state.memory;  
  registers.pc = state.pc;  
  registers.sp = state.sp;  
  registers.a = state.a;  
  registers.f = state.f;  
  registers.b = state.b;  
  registers.c = state.c;  
  registers.d = state.d;  
  registers.e = state.e;  
  registers.h = state.h;  
  registers.l = state.l;  
  div = state.div;  
  tima = state.tima;  
  tma = state.tma;  
  tac = state.tac;  
  joypadState = state.joypadState;  
}
```

- **loadState()** restores the emulator state to the values stored in the `SaveState` object.

## Conclusion

In this post, we’ve explored how to handle I/O registers for inputs like the joypad, as well as timers and interrupts that control in-game events. Additionally, we implemented **save and load states**, allowing players to save the exact game state and load it later. These features are crucial for creating a smooth and flexible gaming experience.

Next, we’ll focus on optimizing the emulator for performance and stability, ensuring it runs efficiently on different devices.

If you have any questions or suggestions, feel free to leave a comment below!
