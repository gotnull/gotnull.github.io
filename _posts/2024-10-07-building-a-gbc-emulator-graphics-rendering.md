---
layout: post  
title: Building a Gameboy Color Emulator - Graphics Rendering  
subtitle: How to Emulate the Gameboy Color’s Display  
tags: [Gameboy Color, GBC, emulator, graphics, rendering, LCD]  
author: Lester Knight Chaykin  
comments: true  
---

{: .box-success}  
In this post, we’re going to explore how graphics are rendered in the Gameboy Color emulator. We will dive into the Gameboy’s **LCD display**, **VRAM**, and the process of drawing tiles and sprites to the screen. This is a critical part of the emulator, as it is responsible for rendering everything you see during gameplay.

## Graphics Overview

The Gameboy Color uses a tile-based graphics system, where the display is divided into small **8x8 pixel tiles**. These tiles are drawn from memory (VRAM) and combined to form backgrounds, sprites, and other on-screen elements.

### LCD and VRAM

The Gameboy Color's screen is **160x144 pixels** and relies on two primary sources for graphical data:
1. **Tile Data**: Stored in VRAM, this defines the pixels for each 8x8 tile.
2. **Tile Maps**: These determine how tiles are arranged on the screen.

### LCD Registers

The Gameboy Color’s display is controlled by a set of registers located in memory from `0xFF40` to `0xFF4B`. Here’s a quick overview of key registers:
- **0xFF40 - LCDC**: LCD Control register. This enables/disables the display and controls background and sprite rendering.
- **0xFF42 - SCY/SCX**: These registers control the scroll position of the background.
- **0xFF47 - BGP**: Background palette data for assigning colors to tiles.

## Drawing Tiles and Sprites

Rendering graphics involves fetching tile data from VRAM, converting it into pixel data, and displaying it on the screen.

Here’s how we approach **rendering tiles**.

### Fetching Tile Data

The first step in rendering is to fetch the pixel data for a tile. Each tile is stored in VRAM as 16 bytes, where each pair of bytes represents one row of the 8x8 tile.

```dart  
List<int> fetchTile(int tileIndex) {  
  int tileAddress = tileIndex * 16;  // Each tile is 16 bytes
  List<int> tilePixels = [];

  for (int row = 0; row < 8; row++) {  
    int byte1 = vram[tileAddress + row * 2];  
    int byte2 = vram[tileAddress + row * 2 + 1];

    // Convert the two bytes into pixel data (2 bits per pixel)
    for (int col = 0; col < 8; col++) {  
      int bit1 = (byte1 >> (7 - col)) & 1;  
      int bit2 = (byte2 >> (7 - col)) & 1;
      int color = (bit2 << 1) | bit1;
      tilePixels.add(color);  
    }  
  }  
  return tilePixels;  
}
```

In this function:
- We calculate the **tile address** in VRAM based on the tile index.
- Each row is stored as two bytes. We extract the bits from these bytes to determine the color of each pixel in the tile.

### Converting Tile Pixels to Framebuffer

Once the tile pixels are fetched, they need to be **converted into colors** and drawn onto the framebuffer, which represents the final image on the screen.

```dart  
void drawTile(List<int> tilePixels, int x, int y) {  
  for (int row = 0; row < 8; row++) {  
    for (int col = 0; col < 8; col++) {  
      int color = tilePixels[row * 8 + col];
      framebuffer[(y + row) * SCREEN_WIDTH + (x + col)] = convertColor(color);  
    }  
  }  
}

int convertColor(int color) {  
  switch (color) {  
    case 0: return 0xFFFFFFFF;  // White  
    case 1: return 0xFFAAAAAA;  // Light Gray  
    case 2: return 0xFF555555;  // Dark Gray  
    case 3: return 0xFF000000;  // Black  
  }  
  return 0xFFFFFFFF;  
}
```

- **drawTile()** places the tile on the framebuffer at the desired position (x, y).
- **convertColor()** translates the 2-bit color value from the tile into a 32-bit RGBA color that the screen can display (e.g., white, light gray, dark gray, or black).

### Rendering Sprites

Sprites are drawn similarly to tiles, but they have additional attributes such as position, size, and palette. Here’s how we approach rendering sprites.

```dart  
void drawSprite(int spriteIndex) {  
  int spriteAddress = spriteIndex * 4;  // Each sprite has 4 bytes of attributes
  int y = oam[spriteAddress] - 16;  // Y position  
  int x = oam[spriteAddress + 1] - 8;  // X position  
  int tileIndex = oam[spriteAddress + 2];  // Tile index  
  int attributes = oam[spriteAddress + 3];  // Attributes (e.g., flip, palette)

  List<int> tilePixels = fetchTile(tileIndex);  
  if (attributes & 0x20 != 0) {  
    // Flip vertically if needed  
    tilePixels = flipVertical(tilePixels);  
  }  
  if (attributes & 0x40 != 0) {  
    // Flip horizontally if needed  
    tilePixels = flipHorizontal(tilePixels);  
  }  
  drawTile(tilePixels, x, y);  
}

List<int> flipVertical(List<int> tilePixels) {  
  List<int> flipped = List.filled(64, 0);  
  for (int row = 0; row < 8; row++) {  
    for (int col = 0; col < 8; col++) {  
      flipped[(7 - row) * 8 + col] = tilePixels[row * 8 + col];  
    }  
  }  
  return flipped;  
}

List<int> flipHorizontal(List<int> tilePixels) {  
  List<int> flipped = List.filled(64, 0);  
  for (int row = 0; row < 8; row++) {  
    for (int col = 0; col < 8; col++) {  
      flipped[row * 8 + (7 - col)] = tilePixels[row * 8 + col];  
    }  
  }  
  return flipped;  
}
```

### Sprite Attributes and Flipping

Sprites have special attributes:
- **Position**: Sprites can be positioned anywhere on the screen using the `x` and `y` values.
- **Flipping**: Some sprites can be flipped horizontally or vertically, depending on the game.

## Double Buffering for Smooth Rendering

To prevent **screen tearing** (which can occur when the display is updated mid-frame), we use **double buffering**. The idea is to draw the frame to an off-screen buffer (the framebuffer) and then display the entire frame at once.

```dart  
void renderFrame() {  
  // Swap the buffers to display the new frame  
  swapBuffers();  
}

void swapBuffers() {  
  for (int i = 0; i < SCREEN_SIZE; i++) {  
    screen[i] = framebuffer[i];  
  }  
  // Now the screen has been updated with the new frame  
}
```

By swapping the buffers at the end of each frame, we ensure smooth and flicker-free rendering.

## Conclusion

In this post, we’ve explored how to handle graphics rendering in our Gameboy Color emulator. We covered how tiles and sprites are fetched from memory, how pixel data is processed and drawn to the framebuffer, and how double buffering ensures smooth rendering. These techniques are essential for recreating the Gameboy Color’s graphics faithfully.

Next, we will dive into handling **audio emulation** and how to recreate the Gameboy’s sound hardware in our emulator.

If you have any questions or suggestions, feel free to leave a comment below!
