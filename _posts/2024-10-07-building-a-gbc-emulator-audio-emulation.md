---
layout: post  
title: Building a Gameboy Color Emulator - Audio Emulation  
subtitle: Recreating the Sound of the Gameboy Color  
tags: [Gameboy Color, GBC, emulator, audio, sound, channels, emulation]  
author: Lester Knight Chaykin  
comments: true  
---

{: .box-success}  
In this post, we’ll explore how to emulate the sound hardware of the Gameboy Color. The Gameboy uses multiple sound channels to generate different types of audio, and accurately reproducing this is key to making the emulator feel authentic. We'll go over how sound channels work, how waveforms are generated, and how to integrate audio into the emulator.

## Overview of the Gameboy Color’s Sound Hardware

The Gameboy Color has a **4-channel audio system**, with each channel designed to produce different types of sounds. These channels are:
- **Square Wave Channels (1 & 2)**: Used for melodic tunes and effects.
- **Wave Channel (3)**: Plays custom waveforms.
- **Noise Channel (4)**: Produces noise sounds, often used for percussive effects.

Each channel is controlled by a set of memory-mapped I/O registers that define parameters like frequency, volume, and envelope settings.

### Sound Registers

Each sound channel is controlled through a series of sound registers located between `0xFF10` and `0xFF3F`. These registers control various aspects of sound generation, including:
- **Frequency**: The pitch of the sound.
- **Volume**: The loudness of the sound.
- **Duty Cycle**: For square wave channels, this defines the shape of the waveform.

## Square Wave Channels (1 & 2)

The square wave channels produce sound waves with a selectable duty cycle (12.5%, 25%, 50%, or 75%). These channels are primarily used for melodies and sound effects.

### Generating a Square Wave

Here’s a simplified approach to generating square wave audio data:

```dart  
class SquareWaveChannel {  
  int frequency;  // The frequency of the square wave  
  int duty;  // Duty cycle (0 = 12.5%, 1 = 25%, 2 = 50%, 3 = 75%)  
  int volume;  // Volume of the sound  
  int cyclePosition = 0;  // Tracks the position in the waveform cycle

  int generateSample() {  
    // Determine the position in the duty cycle (0-7)
    int position = (cyclePosition >> 8) % 8;

    // Select the duty cycle pattern (0 = 12.5%, 1 = 25%, etc.)
    int pattern = _getDutyCyclePattern(duty);

    // Use the pattern to determine the sample value (0 or 1)
    int sample = (pattern >> (7 - position)) & 1;

    // Scale the sample by the volume
    return sample * volume;
  }

  int _getDutyCyclePattern(int duty) {  
    switch (duty) {  
      case 0: return 0b00000001;  // 12.5% duty cycle  
      case 1: return 0b00000011;  // 25% duty cycle  
      case 2: return 0b00001111;  // 50% duty cycle  
      case 3: return 0b11111100;  // 75% duty cycle  
    }  
    return 0b00000001;  
  }

  void updateCycle(int cycles) {  
    // Increment the cycle position based on the frequency
    cyclePosition += (frequency * cycles);
  }
}
```

In this example:
- **generateSample()** creates a sound sample based on the current position in the waveform.
- The **duty cycle** determines how much of the waveform is "on" versus "off," which changes the sound's character.
- **updateCycle()** advances the waveform by the number of CPU cycles that have passed.

### Managing Frequency and Volume

To create different notes and sound effects, the frequency and volume of the square wave must be controlled. The frequency determines the pitch, while the volume controls how loud the sound is.

## Wave Channel (3)

The wave channel is used for playing custom waveforms. In contrast to the square wave channels, this channel allows you to upload a custom waveform to be played.

### Generating Custom Waveforms

Waveforms are stored in memory at `0xFF30 - 0xFF3F` and consist of 32 4-bit samples. These samples are played back to produce sound.

Here’s how to generate audio from a custom waveform:

```dart  
class WaveChannel {  
  List<int> waveform = List.filled(32, 0);  // Custom waveform data  
  int volume;  
  int cyclePosition = 0;

  int generateSample() {  
    int index = (cyclePosition >> 8) % 32;  // Get the current position in the waveform  
    int sample = waveform[index];  // Fetch the waveform sample

    // Scale the sample by the volume  
    return (sample * volume) >> 2;  // Divide by 4 to fit the audio range  
  }

  void updateCycle(int cycles) {  
    cyclePosition += cycles;  
  }
}
```

- **waveform** holds the custom sound data.
- **generateSample()** fetches the current sample from the waveform and scales it based on the volume.
- **updateCycle()** advances the waveform playback based on the number of CPU cycles that have passed.

## Noise Channel (4)

The noise channel is used for generating noise-based sound effects, like explosions or drums. It generates a random noise pattern by shifting a **linear feedback shift register (LFSR)**.

### Generating Noise

Here’s how to generate noise for the noise channel:

```dart  
class NoiseChannel {  
  int frequency;  
  int volume;  
  int lfsr = 0x7FFF;  // 15-bit Linear Feedback Shift Register  
  int cyclePosition = 0;

  int generateSample() {  
    int sample = (lfsr & 1) * volume;  // Use the LFSR's least significant bit  
    return sample;  
  }

  void updateCycle(int cycles) {  
    cyclePosition += cycles;  
    if (cyclePosition >= frequency) {  
      cyclePosition = 0;  
      stepLFSR();  
    }  
  }

  void stepLFSR() {  
    int bit = ((lfsr >> 1) ^ lfsr) & 1;  // XOR the two bits  
    lfsr = (lfsr >> 1) | (bit << 14);  // Shift the register and insert the new bit  
  }
}
```

- The **LFSR** generates a sequence of pseudo-random bits.
- **generateSample()** uses the least significant bit (LSB) of the LFSR to generate noise.
- **stepLFSR()** updates the LFSR by shifting its value and inserting a new bit generated from XORing the two least significant bits.

## Mixing and Outputting Audio

Each channel (square waves, waveforms, and noise) generates individual samples, which need to be **mixed** together to produce the final sound output.

Here’s how to mix and output audio:

```dart  
int mixAudio(SquareWaveChannel channel1, SquareWaveChannel channel2, WaveChannel waveChannel, NoiseChannel noiseChannel) {  
  int sample1 = channel1.generateSample();  
  int sample2 = channel2.generateSample();  
  int waveSample = waveChannel.generateSample();  
  int noiseSample = noiseChannel.generateSample();

  // Mix the samples by summing them and clamping the result to the allowed range
  int mixedSample = (sample1 + sample2 + waveSample + noiseSample) ~/ 4;
  return mixedSample.clamp(0, 255);  // Ensure the value is within range  
}
```

In this function:
- **mixAudio()** combines the audio samples from all channels by averaging them.
- The final mixed sample is clamped to ensure it doesn’t exceed the allowable range of values (0-255).

## Conclusion

In this post, we’ve explored how to emulate the audio hardware of the Gameboy Color. We’ve covered the implementation of square wave channels, custom waveforms, and noise generation. We also touched on how to mix the audio from these channels into a final output signal. With this, our emulator can now produce sound that mirrors the original Gameboy Color hardware.

Next, we will focus on **input/output registers** and how to handle saving and loading game states.

If you have any questions or suggestions, feel free to leave a comment below!
