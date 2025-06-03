# MARCHING CUBES: VISUAL REFERENCE GUIDE

## CHUNK COORDINATE SYSTEM

```
                                     +Z
                                      ↑
                                      |
                                      |
                                      |
                                      |
                                      |
                                      |
                                      o----> +X
                                     /
                                    /
                                   /
                                  /
                                 /
                                ↙
                               +Y
```

## CHUNK BOUNDARIES & CONNECTIVITY

### Horizontal Chunk Grid (Top View at Same Y Level)
```
     +-----+-----+-----+
     |     |     |     |
     |  A  |  B  |  C  |
     |     |     |     |
     +-----+-----+-----+
     |     |     |     |
     |  D  |  E  |  F  |  <-- Chunks at Same Y Level
     |     |     |     |
     +-----+-----+-----+
     |     |     |     |
     |  G  |  H  |  I  |
     |     |     |     |
     +-----+-----+-----+
```

### Six-Connected Neighbors (The Essential Neighbors)
```
                 ┌─────┐
                 │  Y+ │  
                 │  Up │
                 └─────┘
                    ↑
                    │
      ┌─────┐    ┌─────┐    ┌─────┐
      │  X- │    │     │    │  X+ │
      │ Left│←───│  E  │───→│Right│
      └─────┘    └─────┘    └─────┘
                    │
                    ↓
                 ┌─────┐
                 │  Y- │
                 │Down │
                 └─────┘

       * Z+ (Front) and Z- (Back) neighbors
         are coming out of and going into the page
```

### Complete 26-Connected Neighbors (Full Connectivity)
```
       Vertical Layer Above (Y+1)         Current Vertical Layer (Y)        Vertical Layer Below (Y-1)
    ┌─────┬─────┬─────┬─────┬─────┐    ┌─────┬─────┬─────┬─────┬─────┐    ┌─────┬─────┬─────┬─────┬─────┐
    │     │     │     │     │     │    │     │     │     │     │     │    │     │     │     │     │     │
    │     │     │     │     │     │    │     │     │     │     │     │    │     │     │     │     │     │
    ├─────┼─────┼─────┼─────┼─────┤    ├─────┼─────┼─────┼─────┼─────┤    ├─────┼─────┼─────┼─────┼─────┤
    │     │     │     │     │     │    │     │     │     │     │     │    │     │     │     │     │     │
    │     │  C  │  U  │  C  │     │    │     │  F  │  F  │  F  │     │    │     │  C  │  D  │  C  │     │
    ├─────┼─────┼─────┼─────┼─────┤    ├─────┼─────┼─────┼─────┼─────┤    ├─────┼─────┼─────┼─────┼─────┤
    │     │     │     │     │     │    │     │     │     │     │     │    │     │     │     │     │     │
    │     │  E  │  E  │  E  │     │    │     │  F  │  C  │  F  │     │    │     │  E  │  E  │  E  │     │
    ├─────┼─────┼─────┼─────┼─────┤    ├─────┼─────┼─────┼─────┼─────┤    ├─────┼─────┼─────┼─────┼─────┤
    │     │     │     │     │     │    │     │     │     │     │     │    │     │     │     │     │     │
    │     │  C  │  D  │  C  │     │    │     │  F  │  F  │  F  │     │    │     │  C  │  U  │  C  │     │
    ├─────┼─────┼─────┼─────┼─────┤    ├─────┼─────┼─────┼─────┼─────┤    ├─────┼─────┼─────┼─────┼─────┤
    │     │     │     │     │     │    │     │     │     │     │     │    │     │     │     │     │     │
    │     │     │     │     │     │    │     │     │     │     │     │    │     │     │     │     │     │
    └─────┴─────┴─────┴─────┴─────┘    └─────┴─────┴─────┴─────┴─────┘    └─────┴─────┴─────┴─────┴─────┘

Legend:
C: Current chunk (center)
F: Face-adjacent neighbors (6 total - essential for seamless terrain)
E: Edge-adjacent neighbors (12 total - needed for diagonal connectivity)
U: Corner-adjacent neighbors above (4 total)
D: Corner-adjacent neighbors below (4 total)
```

## CRITICAL BOUNDARY CONSIDERATIONS

```
       Chunk 1                Chunk 2
    +----------+           +----------+
    |          |           |          |
    |          |           |          |
    |          |           |          |
    |       X  | <--Gap--> X          |  <- Incorrect (gap)
    |          |           |          |
    |          |           |          |
    +----------+           +----------+

       Chunk 1                Chunk 2
    +----------+--+----------+
    |          |  |          |
    |          |  |          |
    |          |  |          |
    |       X  |XX|X         |  <- Correct (seamless)
    |          |  |          |
    |          |  |          |
    +----------+--+----------+
```

## CUBE CORNERS AT CHUNK BOUNDARIES

```
    +-------+-------+
    |       |       |
    |   A   |   B   |
    |       |       |
    +-------+-------+
    |       |       |
    |   C   |   D   |
    |       |       |
    +-------+-------+

Corner Cases:
- Corner at intersection A,B,C,D needs data from all 4 chunks
- Edge between A and B needs data from both chunks
- Interior points only need their own chunk's data
```

## NOISE VALUE RETRIEVAL

```
[ Noise Grid - 4x4 ]

o = noise point
+ = chunk boundary

o---o---o---o---+---o---o---o---o
|   |   |   |   |   |   |   |   |
o---o---o---o---+---o---o---o---o
|   |   |   |   |   |   |   |   |
o---o---o---o---+---o---o---o---o
|   |   |   |   |   |   |   |   |
o---o---o---o---+---o---o---o---o
+---+---+---+---+---+---+---+---+
o---o---o---o---+---o---o---o---o
|   |   |   |   |   |   |   |   |
o---o---o---o---+---o---o---o---o
|   |   |   |   |   |   |   |   |
o---o---o---o---+---o---o---o---o
|   |   |   |   |   |   |   |   |
o---o---o---o---+---o---o---o---o
```

## MARCHING CUBES ALGORITHM DETAILS

### Cube Corner & Edge Numbering System
```
    7 --- 6
   /|    /|
  4 --- 5 |
  | 3 --| 2
  |/    |/
  0 --- 1

  Corner Indices (0-7):
  0: Bottom-Left-Back   1: Bottom-Right-Back
  2: Bottom-Right-Front 3: Bottom-Left-Front
  4: Top-Left-Back      5: Top-Right-Back
  6: Top-Right-Front    7: Top-Left-Front

  Edge Mapping (0-11):
  0: (0-1), 1: (1-2), 2: (2-3), 3: (3-0)  // Bottom edges
  4: (4-5), 5: (5-6), 6: (6-7), 7: (7-4)  // Top edges
  8: (0-4), 9: (1-5), 10: (2-6), 11: (3-7) // Vertical edges
```

### Cube Index Calculation
```
For each cube, we generate an 8-bit index (0-255) based on which corners are inside/outside:

  Corner Value < SURFACE_LEVEL: Inside (1)
  Corner Value ≥ SURFACE_LEVEL: Outside (0)

  Bit Assignment:
  Corner 0: 2^0 = 1
  Corner 1: 2^1 = 2
  Corner 2: 2^2 = 4
  Corner 3: 2^3 = 8
  Corner 4: 2^4 = 16
  Corner 5: 2^5 = 32
  Corner 6: 2^6 = 64
  Corner 7: 2^7 = 128

  Index Calculation:
  cubeIndex = 0
  for i = 0 to 7:
    if cornerValue[i] < SURFACE_LEVEL:
      cubeIndex |= (1 << i)

  Example: If corners 0, 3, and 4 are inside:
  cubeIndex = 1 + 8 + 16 = 25
```

### Triangulation Process
```
  1. Get cube index (0-255) from corner values
  2. Look up edge list from triangulation table for this index
  3. For each set of 3 edges in the list:
     a. Determine which corners form each edge
     b. Interpolate vertex position along each edge
     c. Create a triangle from these 3 vertices
```

### Example Configurations

#### Case 1: One Corner Inside (Index = 1)
```
        O
       /|
      / |
     /  |
    O---O
   /|  /|
  O-|--O |
  | O--|-O
  |/  |/
  ●---O

  ● = Corner below surface (inside)
  O = Corner above surface (outside)

  Triangulation:
  One triangle connecting the three edges 
  intersected by the surface.
```

#### Case 7: Three Adjacent Corners Inside (Index = 7)
```
        O
       /|
      / |
     /  |
    O---O
   /|  /|
  O-|--O |
  | ●--|-O
  |/  |/
  ●---●

  Configuration creates two connected triangles
  forming a "wedge" shape.
```

#### Case 254: Seven Corners Inside (Index = 254)
```
        ●
       /|
      / |
     /  |
    ●---●
   /|  /|
  ●-|--● |
  | ●--|-●
  |/  |/
  ●---O

  Mirror of Case 1 - single triangle
  but with opposite orientation.
```

## LOADING PRIORITY VISUALIZATION

```
  Far (4)  Medium (3)  Near (2)  Adjacent (1)  Immediate (0)  Adjacent (1)  Near (2)  Medium (3)  Far (4) 
  .  .  .   .  .  .     .  .  .    .  .  .       .  .  .        .  .  .      .  .  .    .  .  .     .  .  .
  .  .  .   .  .  .     .  .  .    .  .  .       .  .  .        .  .  .      .  .  .    .  .  .     .  .  .
  
  .  .  .   .  .  .     .  .  .    .  .  .       .  .  .        .  .  .      .  .  .    .  .  .     .  .  .
  .  .  .   .  .  .     .  .  .    .  .  .       .  .  .        .  .  .      .  .  .    .  .  .     .  .  .
  
  .  .  .   .  .  .     .  .  .    1  1  1       0  0  0        1  1  1      .  .  .    .  .  .     .  .  .
  .  .  .   .  .  .     .  .  .    1  P  1       0  0  0        1  1  1      .  .  .    .  .  .     .  .  .
  
  .  .  .   .  .  .     .  .  .    .  .  .       .  .  .        .  .  .      .  .  .    .  .  .     .  .  .
  .  .  .   .  .  .     .  .  .    .  .  .       .  .  .        .  .  .      .  .  .    .  .  .     .  .  .
```

## COMMON FAILURE PATTERNS

```
[ Gap Due to Coordinate Mismatch ]

ChunkA              ChunkB
+--+--+--+--+       +--+--+--+--+
|  |  |  |  |       |  |  |  |  |  
+--+--+--+--|       |--+--+--+--+
|  |  |  |  |       |  |  |  |  |
+--+--+--+--|  GAP  |--+--+--+--+
|  |  |  |  |       |  |  |  |  |
+--+--+--+--+       +--+--+--+--+
```

```
[ Gap Due to Different Threshold ]

Threshold = -0.1         Threshold = 0.1
+--+--+--+--+--+--+--+--+--+--+--+
|                                |
+--+--+--+--+     +--+--+--+--+--+
|          |     |              |
+--+--+--+--+     +--+--+--+--+--+
|          |     |              |
+--+--+--+--+--+--+--+--+--+--+--+
```

```
[ Gap Due to Missing Neighbor Data ]

+--+--+--+--+--+--+--+--+--+
|                          |
+--+--+--+--+     +--+--+--+
|          |     |        |
+--+--+--+--+     +--+--+--+
|          |     |        |
+--+--+--+--+--+--+--+--+--+
```

## CRITICAL COORDINATE TRANSFORMATION

```
// The -0.5 offset is the KEY to aligning chunks properly

╔═══════════════════════════════╗
║ WORLD COORDINATE CALCULATION  ║
╚═══════════════════════════════╝

worldX = x + (chunkX - 0.5) * CHUNK_SIZE
worldY = y + chunkY * CHUNK_HEIGHT 
worldZ = z + (chunkZ - 0.5) * CHUNK_SIZE

╔═══════════════════════════════╗
║ MESH POSITION TRANSFORMATION  ║
╚═══════════════════════════════╝

// Must use EXACTLY the same transformation!
geometry.translate(
  (chunkX - 0.5) * CHUNK_SIZE,
  chunkY * CHUNK_HEIGHT,
  (chunkZ - 0.5) * CHUNK_SIZE
);

╔═══════════════════════════════════════════════════╗
║ VISUALIZATION OF -0.5 OFFSET EFFECT ON ALIGNMENT  ║
╚═══════════════════════════════════════════════════╝

WITHOUT -0.5 OFFSET:                WITH -0.5 OFFSET:
┌────────┬────────┐               ┌────────┬────────┐
│        │        │               │        │        │
│   A    │   B    │               │   A    │   B    │
│        │        │               │        │        │
│        │        │               │        │        │
│        │        │               │        │        │
└────────┴────────┘               └────────┴────────┘
     ↑                                  ↑
     Gap at boundary                Seamless join
```
