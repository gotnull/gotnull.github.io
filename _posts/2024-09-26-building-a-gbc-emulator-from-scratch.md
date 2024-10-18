layout: post  
title: Building a Gameboy Color Emulator from Scratch  
subtitle: A Deep Dive into Gameboy Color Emulation  
tags: [Gameboy Color, GBC, emulator, Flutter, Dart, hardware, software]  
author: Lester Knight Chaykin  
comments: true  

{: .box-success}  
In this blog post, I will explore how to build a Gameboy Color emulator from scratch using Dart and Flutter. We'll cover essential parts of the emulator, including CPU handling, gamepad input, memory mapping, and rendering. I'll guide you through the key components of the project and share code snippets to explain how they fit together.

## Project Overview

### Key Components

This GBC emulator is structured using several essential modules:
- **main.dart**: This file manages the Flutter app’s setup, including window management and UI.
- **emulator.dart**: Handles the emulator state and loop, managing game execution and pause/resume functionality.
- **gamepad_map.dart**: Defines the mapping of gamepad buttons to GBC controls.
- **configuration.dart**: Contains global settings for the emulator, like enabling debug features and rendering options.

## Code Breakdown

### main.dart: Setting Up the Flutter App

The ```main.dart``` file initializes the emulator’s UI and sets up the window size. The app is named **DartBoy** in this example.

```dart  
import 'package:flutter/material.dart';  
import 'package:window_manager/window_manager.dart';  
import 'gui/main_screen.dart';

void main() async {  
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize the window manager  
  await windowManager.ensureInitialized();

  // Set the minimum window size before running the app  
  await setWindowSize();

  // Set the window title  
  windowManager.setTitle('Dart Boy');

  runApp(const DartBoy());  
}

Future<void> setWindowSize() async {  
  // Set the minimum size for the window to prevent resizing  
  await windowManager.setMinimumSize(  
    const Size(1300, 900),  
  );

  // Optionally, set an initial window size to match the minimum size  
  await windowManager.setSize(  
    const Size(1300, 900),  
  );  
}

class DartBoy extends StatelessWidget {  
  const DartBoy({super.key});

  @override  
  Widget build(BuildContext context) {  
    return MaterialApp(  
      title: 'GBC',  
      theme: ThemeData(primarySwatch: Colors.blue),  
      home: const MainScreen(title: 'GBC', key: Key("gbc")),  
      debugShowCheckedModeBanner: false,  
      showPerformanceOverlay: false,  
      showSemanticsDebugger: false,  
      debugShowMaterialGrid: false,  
    );  
  }  
}  
```

### emulator.dart: Managing the Emulator State

The ```emulator.dart``` file is the heart of the emulator. It manages the emulator state (waiting, ready, running), and includes logic to handle loading ROMs, updating CPU cycles, and syncing gamepad inputs.

```dart  
import 'dart:async';  
import 'dart:typed_data';  
import 'package:dartboy/emulator/configuration.dart';  
import 'package:dartboy/emulator/cpu/cpu.dart';  
import 'package:dartboy/emulator/gamepad_map.dart';  
import 'package:dartboy/emulator/memory/cartridge.dart';  
import 'package:dartboy/emulator/memory/gamepad.dart';  
import 'package:gamepads/gamepads.dart';  
import 'package:window_manager/window_manager.dart';

// Represents the state of the emulator.  
enum EmulatorState {  
  waiting,  
  ready,  
  running,  
  paused,  
}

// Emulator class with methods for handling states, ROM loading, and execution.  
class Emulator {  
  EmulatorState state = EmulatorState.waiting;

  void loadROM(Uint8List romData) {  
    // Load the ROM data into memory, setting the state to ready.  
    state = EmulatorState.ready;  
  }

  Future<void> start() async {  
    // Start running the emulator, transitioning to the running state.  
    if (state == EmulatorState.ready) {  
      state = EmulatorState.running;  
      // Main loop to keep the emulator running.  
    }  
  }

  void pause() {  
    // Pause the emulator.  
    state = EmulatorState.paused;  
  }  
}  
```

### gamepad_map.dart: Mapping Gamepad Inputs

In the ```gamepad_map.dart``` file, we map physical gamepad buttons to Gameboy Color buttons such as A, B, Start, and Select. These mappings are critical for handling user inputs correctly.

```dart  
const GamepadKey aButton = GamepadButtonKey(  
  linuxKeyName: '1',  
  macosKeyName: 'a.circle',  
  windowsKeyName: "button-1",  
);

const GamepadKey bButton = GamepadButtonKey(  
  linuxKeyName: '0',  
  macosKeyName: 'b.circle',  
  windowsKeyName: "button-0",  
);

const GamepadKey xButton = GamepadButtonKey(  
  linuxKeyName: '2',  
  macosKeyName: 'x.circle',  
  windowsKeyName: "button-3",  
);

const GamepadKey yButton = GamepadButtonKey(  
  linuxKeyName: '2',  
  macosKeyName: 'y.circle',  
  windowsKeyName: "button-2",  
);

const GamepadKey startButton = GamepadButtonKey(  
  linuxKeyName: '7',  
  macosKeyName: 'line.horizontal.3.circle',  
  windowsKeyName: "button-7",  
);

const GamepadKey selectButton = GamepadButtonKey(  
  linuxKeyName: '6',  
  macosKeyName: 'rectangle.fill.on.rectangle.fill.circle',  
  windowsKeyName: "button-6",  
);  
```

### configuration.dart: Setting Global Emulator Configuration

In ```configuration.dart```, we set global flags to control various emulator features, such as enabling background rendering, audio, or displaying debug information.

```dart  
class Configuration {  
  static bool drawBackgroundLayer = true;  
  static bool drawSpriteLayer = true;  
  static bool printSerialCharacters = false;  
  static bool debugInstructions = false;  
  static bool enableAudio = false;  
}  
```

## Conclusion

This post covered the basic structure of a Gameboy Color emulator built using Dart and Flutter. We walked through key files and explored how they contribute to emulating the Gameboy Color system. Stay tuned for future posts, where we will dive deeper into CPU emulation, memory management, and more.

If you have any questions or suggestions, feel free to leave a comment below!
