---
layout: post  
title: Building a Gameboy Color Emulator - Palette, PPU, and Memory Bank Controllers  
subtitle: Rendering Colors, Managing Memory Banks, and Handling Graphics  
tags: [Gameboy Color, GBC, emulator, palette, PPU, MBC, graphics]  
author: Lester Knight Chaykin  
comments: true  
---

{: .box-success}  
In this post, we’ll dive into some critical systems of the Gameboy Color emulator: the **Palette**, **Pixel Processing Unit (PPU)**, and **Memory Bank Controllers (MBCs)**. These components are responsible for rendering the game’s colors, handling graphics output, and managing memory switching for larger game cartridges.

## Palette and Color Management

The Gameboy Color uses **color palettes** to map specific colors to different sprites and backgrounds. Each palette consists of multiple colors, which are stored in **VRAM**. The `palette.dart` and `palette_colors.dart` files manage how these palettes are stored and used.

### Palette Management

Here’s a simplified look at how color palettes are handled in the emulator:

```dart  
class Palette {  
  static final List<PaletteColors> list = List.generate(256, (index) => PaletteColors([], [], []));

  static void loadPalette() {  
    list[0x00] = PaletteColors(
      [0xFFFFFF, 0xAAAAAA, 0x555555, 0x000000],  // Light palette
      [0xFFFFFF, 0xAAAAAA, 0x555555, 0x000000],  // Dark palette
      [0xFFFFFF, 0xFF0000, 0x0000FF, 0x000000]   // Custom palette
    );
    // Additional palettes can be loaded similarly
  }

  static PaletteColors get(int index) {  
    return list[index];  // Return the palette colors based on index
  }  
}
```

- **PaletteColors** stores three versions of the palette: light, dark, and custom palettes.
- The **loadPalette()** function initializes the color palettes that will be used to render sprites and backgrounds.

Each game uses different palettes to assign colors to specific tiles and sprites. The emulator will fetch the correct palette for a tile or sprite and use it to convert tile data into color pixels.

### Converting Tile Data to Colors

Once we have the correct palette, we need to use it to convert the tile pixel data into actual colors:

```dart  
List<int> convertTileToColors(List<int> tilePixels, PaletteColors palette) {  
  List<int> colorData = [];

  for (int pixel in tilePixels) {  
    colorData.add(palette.getColor(pixel));  // Map pixel value to color using palette
  }

  return colorData;  // Return the color data to be rendered
}
```

This function takes the **tile pixel data** (which is in 2-bit or 4-bit color format) and converts it to actual RGB color values using the specified palette.

## Pixel Processing Unit (PPU)

The **Pixel Processing Unit (PPU)** is responsible for generating the video output of the Gameboy Color. It reads data from VRAM, applies color palettes, and renders the graphics on the screen.

### Rendering Tiles and Sprites

In the `ppu.dart` file, the PPU handles rendering both tiles (background and window layers) and sprites. Here’s how tiles are fetched and drawn:

```dart  
class PPU {  
  Uint8List vram = Uint8List(8192);  // Video RAM  
  Uint8List oam = Uint8List(160);    // Object Attribute Memory for sprites  

  void render() {  
    for (int tileIndex = 0; tileIndex < 256; tileIndex++) {  
      List<int> tilePixels = fetchTile(tileIndex);
      PaletteColors palette = Palette.get(tileIndex);  
      List<int> colors = convertTileToColors(tilePixels, palette);  
      drawTile(colors, tileIndex);  
    }  
  }

  List<int> fetchTile(int tileIndex) {  
    int tileAddress = tileIndex * 16;  
    List<int> tilePixels = [];

    for (int row = 0; row < 8; row++) {  
      int byte1 = vram[tileAddress + row * 2];  
      int byte2 = vram[tileAddress + row * 2 + 1];

      for (int col = 0; col < 8; col++) {  
        int bit1 = (byte1 >> (7 - col)) & 1;  
        int bit2 = (byte2 >> (7 - col)) & 1;
        tilePixels.add((bit2 << 1) | bit1);  
      }  
    }

    return tilePixels;  
  }

  void drawTile(List<int> colors, int tileIndex) {  
    // Render the tile's color data to the framebuffer (or screen)  
    // This step involves rendering the tile at the correct location on the display
  }  
}
```

- **fetchTile()** reads the pixel data for each tile from VRAM.
- **render()** fetches the tile data, applies the palette colors, and calls `drawTile()` to display the tile on the screen.

The PPU also handles **sprites** stored in Object Attribute Memory (OAM), which are drawn on top of the background tiles.

## Memory Bank Controllers (MBC)

Many Gameboy games are larger than the available memory, so the Gameboy Color uses **Memory Bank Controllers (MBCs)** to switch between different memory banks. This allows games to access much larger memory spaces.

### MBC3: Managing ROM and RAM Banks

One of the most common MBCs is the **MBC3**, which handles both ROM and RAM bank switching. It also has support for a real-time clock (RTC) feature used by some games.

```dart  
class MBC3 extends MBC {  
  int ramBank = 0;  // Current RAM bank
  bool rtcEnabled = false;  // Real-time clock enabled  
  Uint8List rtc = Uint8List(4);  // Real-time clock registers  

  MBC3(super.cpu);

  @override  
  void writeByte(int address, int value) {  
    address &= 0xFFFF;

    if (address >= MBC1.ramDisableStart && address < MBC1.ramDisableEnd) {  
      ramEnabled = (value & 0x0F) == ramEnableValue;  
      rtcEnabled = (value & 0x0F) == ramEnableValue;  
    } else if (address >= MBC1.romBankSelectStart && address < MBC1.romBankSelectEnd) {  
      romPageStart = Memory.romPageSize * max(value & 0x7F, 1);  
    } else if (address >= 0x4000 && address < 0x6000) {  
      // RTC register selection
      if (value >= rtcRegisterStart && value <= rtcRegisterEnd) {  
        if (rtcEnabled) {  
          ramBank = -1;  // Select RTC register
        }  
      } else if (value <= 0x03) {  
        ramBank = value;  
        ramPageStart = ramBank * MBC.ramPageSize;  
      }  
    }
  }
}
```

- **MBC3** manages ROM and RAM banks, allowing games to access memory outside of the base memory range.
- The **rtcEnabled** flag determines whether the real-time clock registers are active, which is used by games like *Pokemon Gold* and *Silver*.

### Other MBC Types

There are other types of MBCs as well, such as:
- **MBC1**: Handles basic ROM and RAM switching, used in smaller games.
- **MBC5**: Similar to MBC3 but supports larger memory sizes without the real-time clock feature.

Each MBC type has its own handling logic, but they all share the same goal: expanding the available memory space for games.

## Conclusion

In this post, we’ve covered three crucial systems in the Gameboy Color emulator: **palette management**, the **Pixel Processing Unit (PPU)**, and **Memory Bank Controllers (MBCs)**. These components are key to rendering the game’s graphics and handling larger memory spaces for more complex games.

Next, we’ll move on to finalizing the emulator, testing, and debugging across different platforms.

If you have any questions or suggestions, feel free to leave a comment below!
