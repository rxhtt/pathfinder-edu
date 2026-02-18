<div align="center">

# 🧭 DharwadAlgo PRO

### An Interactive 3D Pathfinding Simulation
#### Visualizing **BFS** & **A\*** Search Algorithms on Real-World Map Data

<br/>

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Three.js](https://img.shields.io/badge/Three.js-r160-000000?style=for-the-badge&logo=threedotjs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![GSAP](https://img.shields.io/badge/GSAP-3-88CE02?style=for-the-badge&logo=greensock&logoColor=black)
![Google Maps](https://img.shields.io/badge/Google_Maps_API-4285F4?style=for-the-badge&logo=googlemaps&logoColor=white)

<br/>

> **Simulation Created by:** [Rohit Bagewadi](https://github.com/rohitbagewadi) — BCA Student, GFGC College, Dharwad
>
> *"Built to make abstract computer science algorithms tangible through real-world 3D visualization."*

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Live Demo](#-live-demo)
- [Algorithms Explained](#-algorithms-explained)
  - [Breadth-First Search (BFS)](#breadth-first-search-bfs)
  - [A\* (A-Star) Search](#a-a-star-search)
  - [BFS vs A\* Comparison](#bfs-vs-a-comparison)
- [Real-World Context](#-real-world-context)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [How to Use](#-how-to-use)
- [Credits](#-credits)

---

## 🌐 Overview

**DharwadAlgo PRO** is a full-stack 3D pathfinding visualizer that brings computer science algorithms to life using real satellite imagery of **Dharwad, Karnataka, India**. The simulation navigates between two real-world landmarks:

| Location | Coordinates |
|----------|-------------|
| 🟢 **GFGC College** (Saptapur) | `15.4707° N, 74.9916° E` |
| 🔴 **KCD Arts College** | `15.4530° N, 74.9980° E` |

The 3D grid is overlaid on live **Google Satellite imagery**, with procedurally generated buildings and road corridors that mimic the real urban layout of Dharwad. Users can interactively place and remove walls (buildings), then watch BFS or A* navigate the city in real time.

---

## 🚀 Live Demo

```bash
# Clone the repository
git clone https://github.com/rohitbagewadi/dharwad-algo-pro.git

# Navigate into the project
cd pathfinding_visualizer

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open your browser at **[http://localhost:5173](http://localhost:5173)**

---

## 🧠 Algorithms Explained

### Breadth-First Search (BFS)

BFS is an **uninformed, exhaustive** graph traversal algorithm. It explores all nodes at the current depth level before moving to the next — like a ripple spreading outward from a stone dropped in water.

```
Algorithm BFS(Grid, Start, End):
  Initialize Queue Q
  Enqueue Start → Mark Start as visited

  While Q is not empty:
    current ← Q.dequeue()

    If current == End:
      Backtrack from End to Start using parent pointers
      Return path

    For each unvisited neighbor of current:
      Mark neighbor as visited
      Set neighbor.parent = current
      Q.enqueue(neighbor)

  Return "No path found"
```

**Key Properties:**

| Property | Value |
|----------|-------|
| Completeness | ✅ Always finds a path if one exists |
| Optimality | ✅ Shortest path guaranteed (unweighted) |
| Time Complexity | `O(V + E)` |
| Space Complexity | `O(V)` |
| Data Structure | Queue (FIFO) |
| Heuristic | ❌ None — Blind search |

**Visualization:** Nodes light up in **neon blue** as BFS explores them in concentric layers outward from GFGC College.

---

### A\* (A-Star) Search

A\* is an **informed, heuristic-guided** search algorithm. It combines the actual cost to reach a node `g(n)` with an estimated cost to the goal `h(n)`, always expanding the most promising node first.

```
f(n) = g(n) + h(n)

Where:
  g(n) = actual cost from Start to node n
  h(n) = heuristic estimate from n to End (Manhattan Distance)
  f(n) = total estimated cost of path through n
```

```
Algorithm A*(Grid, Start, End):
  Initialize Open List (Priority Queue) with Start
  Set g(Start) = 0, f(Start) = h(Start)

  While Open List is not empty:
    current ← node in Open with lowest f(n)

    If current == End:
      Reconstruct path from End to Start
      Return path

    Move current to Closed List

    For each neighbor of current:
      tentative_g = g(current) + cost(current, neighbor)

      If tentative_g < g(neighbor):
        neighbor.parent = current
        g(neighbor) = tentative_g
        h(neighbor) = |neighbor.row - End.row| + |neighbor.col - End.col|
        f(neighbor) = g(neighbor) + h(neighbor)
        Add neighbor to Open List if not present

  Return "No path found"
```

**Key Properties:**

| Property | Value |
|----------|-------|
| Completeness | ✅ Always finds a path if one exists |
| Optimality | ✅ Guaranteed with admissible heuristic |
| Time Complexity | `O(E log V)` |
| Space Complexity | `O(V)` |
| Data Structure | Priority Queue (Min-Heap) |
| Heuristic | ✅ Manhattan Distance `\|Δrow\| + \|Δcol\|` |

**Visualization:** Nodes light up in **amber/gold** as A\* cuts directly toward KCD Arts College, exploring far fewer nodes than BFS.

---

### BFS vs A\* Comparison

| Criterion | BFS | A\* |
|-----------|-----|-----|
| Search Style | Exhaustive (Blind) | Guided (Informed) |
| Nodes Explored | Many (all at each depth) | Few (guided by heuristic) |
| Speed | Slower | Faster |
| Memory Usage | Higher | Higher |
| Shortest Path | ✅ Yes | ✅ Yes |
| Weighted Graphs | ❌ No | ✅ Yes |
| Heuristic | ❌ None | ✅ Manhattan Distance |
| Real-world Use | Social Networks, Web Crawlers | GPS Navigation, Game AI |

> **In this simulation:** A\* typically explores **30–60% fewer nodes** than BFS to find the same optimal path between GFGC and KCD.

---

## 📍 Real-World Context

The simulation is geographically anchored to the **Dharwad Education Corridor** — a stretch of road connecting two of Dharwad's most prominent colleges.

```
GFGC College (Saptapur)
  ↓  ~2.1 km via College Road
KCD Arts College (Hubli-Dharwad)
```

The Google Maps Static API captures a **1024×1024 satellite tile** centered between the two campuses at zoom level 15, which is used as the 3D ground texture. The procedural building generator creates urban obstacles that approximate the real-world density of the area.

---

## ✨ Features

### 🗺️ 3D Visualization
- Real-time **Google Satellite imagery** as the ground plane
- Procedurally generated **3D buildings** with varying heights
- Floating **landmark markers** for GFGC and KCD with GPS coordinates
- **Atmospheric night-time rendering** with stars, bloom, and vignette effects

### 🧪 Algorithm Simulation
- **Interactive wall placement** — click any node to build/remove a building
- **Animated node exploration** — buildings rise from the ground as they are visited
- **Path highlighting** — the optimal route glows in gold
- **Real-time statistics** — nodes explored, path length, compute time

### 📚 Learning Center
- Slide-in **Algorithm Learning Center** sidebar
- Full **BFS theory** with pseudocode, complexity, and use cases
- Full **A\* theory** with heuristic formula and step-by-step logic
- **BFS vs A\* comparison** table

### 🎨 Professional UI
- Glassmorphic navbar and panels
- Color-coded legend
- Interactive hint bar
- Responsive layout

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework and state management |
| **Three.js** | 3D rendering engine |
| **@react-three/fiber** | React renderer for Three.js |
| **@react-three/drei** | Three.js helpers (Float, Stars, Text, etc.) |
| **@react-three/postprocessing** | Bloom, Vignette, Chromatic Aberration |
| **GSAP** | High-performance animation for node transitions |
| **Google Maps Static API** | Real satellite imagery of Dharwad |
| **Vite** | Ultra-fast build tool and dev server |
| **Lucide React** | Icon library |

---

## 📁 Project Structure

```
pathfinding_visualizer/
├── public/
├── src/
│   ├── algorithms/
│   │   ├── bfs.js          # BFS implementation with path reconstruction
│   │   └── astar.js        # A* implementation with Manhattan heuristic
│   ├── App.jsx             # Main application — 3D scene, UI, simulation logic
│   ├── index.css           # Professional glassmorphic design system
│   └── main.jsx            # React entry point
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18 or higher
- **npm** v9 or higher

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/rohitbagewadi/dharwad-algo-pro.git
cd pathfinding_visualizer

# 2. Install all dependencies
npm install

# 3. Start the development server
npm run dev

# 4. Open in browser
# → http://localhost:5173
```

### Build for Production

```bash
npm run build
npm run preview
```

---

## 🎮 How to Use

| Action | How |
|--------|-----|
| **Place a wall** | Click any transparent node on the grid |
| **Remove a wall** | Click an existing building node |
| **Rotate view** | Click and drag on the 3D canvas |
| **Zoom** | Scroll wheel |
| **Run simulation** | Click **"Start Route"** in the navbar |
| **Reset grid** | Click **"Reset"** to generate a new city layout |
| **Learn algorithms** | Click **"Learn Algorithms"** to open the sidebar |
| **Switch algorithm** | Use the dropdown to toggle between BFS and A\* |

---

## 👤 Credits

<table>
  <tr>
    <td align="center">
      <strong>Rohit Bagewadi</strong><br/>
      <sub>BCA Student</sub><br/>
      <sub>Government First Grade College (GFGC)</sub><br/>
      <sub>Saptapur, Dharwad, Karnataka — 580001</sub>
    </td>
  </tr>
</table>

**Simulation Purpose:** Academic project to demonstrate the practical application of graph traversal algorithms (BFS and A\*) using an interactive 3D environment grounded in real-world geographic data.

**Supervised under:** Department of Computer Science, GFGC College, Dharwad

---

<div align="center">

**DharwadAlgo PRO** — *Where Computer Science Meets the Real World*

Made with ❤️ in Dharwad, Karnataka 🇮🇳

</div>
