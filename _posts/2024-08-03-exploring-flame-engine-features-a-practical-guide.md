---
layout: post
title: Exploring Flame Engine Features - A Practical Guide
subtitle: A Deep Dive into Animation, Input, Backgrounds, Particles, and Collisions
tags: [Flame Engine, game development, Dart]
author: Lester Knight Chaykin
comments: true
mathjax: true
---

{: .box-success}
The Flame engine provides a powerful and flexible framework for game development in Dart. In this post, we’ll explore various features of Flame through practical examples, covering animation, input handling, backgrounds, particles, and collision detection. These examples should help you get started with developing your own games using Flame.

## 1. Basic Sprite Animation

Animating sprites is fundamental in game development. Here’s how you can animate a sprite using Flame:

```dart
import 'package:flame/game.dart';
import 'package:flame/components.dart';

class MyGame extends FlameGame {
  late SpriteAnimationComponent character;

  @override
  Future<void> onLoad() async {
    final spriteSheet = await loadSpriteSheet(
      'character.png',
      width: 64,
      height: 64,
    );
    final animation = SpriteAnimation.spriteList(
      spriteSheet,
      stepTime: 0.1,
    );
    character = SpriteAnimationComponent(
      animation: animation,
      size: Vector2.all(64),
    );
    add(character);
  }

  @override
  void update(double dt) {
    super.update(dt);
    character.position += Vector2(1, 0) * dt * 100; // Move the character
  }
}
```

## 2. Handling Input

This example demonstrates how to handle user input to move a sprite around the screen.

```dart
import 'package:flame/game.dart';
import 'package:flame/components.dart';

class MyGame extends FlameGame with KeyboardEvents {
  late SpriteComponent player;

  @override
  Future<void> onLoad() async {
    final sprite = await loadSprite('player.png');
    player = SpriteComponent()
      ..sprite = sprite
      ..size = Vector2.all(50)
      ..position = Vector2(100, 100);
    add(player);
  }

  @override
  void onKeyEvent(KeyEvent event, bool pressed) {
    if (event is RawKeyDownEvent) {
      if (pressed) {
        switch (event.logicalKey.keyId) {
          case LogicalKeyboardKey.arrowLeft.keyId:
            player.position.x -= 10;
            break;
          case LogicalKeyboardKey.arrowRight.keyId:
            player.position.x += 10;
            break;
          case LogicalKeyboardKey.arrowUp.keyId:
            player.position.y -= 10;
            break;
          case LogicalKeyboardKey.arrowDown.keyId:
            player.position.y += 10;
            break;
        }
      }
    }
  }
}
```

## 3. Adding a Background

This example demonstrates how to add a static background to the game scene.

```dart
import 'package:flame/game.dart';
import 'package:flame/components.dart';

class MyGame extends FlameGame {
  late SpriteComponent background;

  @override
  Future<void> onLoad() async {
    final bgSprite = await loadSprite('background.png');
    background = SpriteComponent()
      ..sprite = bgSprite
      ..size = size; // Use the game size as background size
    add(background);
  }
}
```

## 4. Creating a Particle System

This example illustrates how to create a simple particle system using Flame.

```dart
import 'package:flame/game.dart';
import 'package:flame/components.dart';
import 'package:flame/extensions.dart';

class Particle extends PositionComponent with HasGameRef<MyGame> {
  Particle(Vector2 position) {
    this.position = position;
    size = Vector2.all(5);
    paint.color = const Color(0xFFFF0000); // Red color
  }

  @override
  void update(double dt) {
    position.y -= 100 * dt; // Move upwards
    if (position.y < 0) {
      removeFromParent(); // Remove particle when it goes off-screen
    }
  }
}

class MyGame extends FlameGame {
  @override
  Future<void> onLoad() async {
    for (int i = 0; i < 100; i++) {
      final particle = Particle(Vector2.random() * size);
      add(particle);
    }
  }
}
```

## 5. Implementing a Simple Collision Detection

This example shows how to implement basic collision detection between two components.

```dart
import 'package:flame/game.dart';
import 'package:flame/components.dart';

class Player extends SpriteComponent with CollisionCallbacks {
  Player() : super(size: Vector2.all(50));

  @override
  void update(double dt) {
    super.update(dt);
    // Handle movement and other updates
  }

  @override
  void onCollision(Set<Vector2> points, CollisionCallback callback) {
    super.onCollision(points, callback);
    print('Collision detected!');
  }
}

class Obstacle extends SpriteComponent with CollisionCallbacks {
  Obstacle() : super(size: Vector2.all(50));

  @override
  void update(double dt) {
    super.update(dt);
    // Handle movement and other updates
  }
}

class MyGame extends FlameGame {
  late Player player;
  late Obstacle obstacle;

  @override
  Future<void> onLoad() async {
    player = Player();
    obstacle = Obstacle();

    add(player);
    add(obstacle);

    // Set initial positions for demo purposes
    player.position = Vector2(100, 100);
    obstacle.position = Vector2(120, 120);

    player.addCollisionWith(obstacle);
  }
}
```

These examples cover a range of functionalities that Flame offers for game development. Use these as a starting point to create your own games with more advanced features and mechanics.