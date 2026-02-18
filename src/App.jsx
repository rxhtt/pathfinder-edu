import React, { useState, useEffect, useRef, Suspense, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Stars, Float, Html, Line } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import {
  Navigation, RotateCcw, BookOpen, GraduationCap, MousePointerClick,
  Swords, Clock, Zap, Cpu, X, Wifi, WifiOff, MapPin, Route,
  ChevronRight, Activity, BarChart2, Info
} from 'lucide-react';
import { bfs, getNodesInShortestPathOrder } from './algorithms/bfs';
import { astar } from './algorithms/astar';
import { fetchRoadNetwork, getWeightForCoord, gridToLatLng } from './roadNetwork';
import './index.css';

// ─── Config ──────────────────────────────────────────────────────────────────
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const CENTER_COORDS = { lat: 15.4618, lng: 74.9948 };
const GRID_SIZE = 22;
const NODE_SIZE = 1.0;
const NODE_GAP = 0.08;
const STEP = NODE_SIZE + NODE_GAP;
const OFFSET = (GRID_SIZE * STEP) / 2;

// Real-world coordinates for the two colleges
const GFGC_COORDS = { lat: 15.4707, lng: 74.9916, name: 'GFGC College', area: 'Kumareshwarnagar, Dharwad' };
const KCD_COORDS = { lat: 15.4530, lng: 74.9980, name: 'KCD Arts College', area: 'Kuvempu Nagar, Dharwad' };

// Haversine distance in km
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STRAIGHT_LINE_KM = haversineKm(GFGC_COORDS.lat, GFGC_COORDS.lng, KCD_COORDS.lat, KCD_COORDS.lng);
// Grid scale: GRID_SIZE nodes ≈ real bounding box
const BOUNDS = { north: 15.4750, south: 15.4480, east: 75.0050, west: 74.9850 };
const LAT_SPAN = BOUNDS.north - BOUNDS.south;
const LNG_SPAN = BOUNDS.east - BOUNDS.west;
const KM_PER_NODE_LAT = (LAT_SPAN / GRID_SIZE) * 111.32;
const KM_PER_NODE_LNG = (LNG_SPAN / GRID_SIZE) * 111.32 * Math.cos(CENTER_COORDS.lat * Math.PI / 180);
const KM_PER_NODE = (KM_PER_NODE_LAT + KM_PER_NODE_LNG) / 2;

// ─── Terrain Definitions ─────────────────────────────────────────────────────
const TERRAIN = {
  HIGHWAY: { weight: 1, h: 0.10, color: '#52525b', emissive: '#27272a', label: 'Highway', isWall: false, roadColor: '#3f3f46' },
  ROAD: { weight: 1, h: 0.10, color: '#4b5563', emissive: '#374151', label: 'Road', isWall: false, roadColor: '#374151' },
  ALLEY: { weight: 2.5, h: 0.08, color: '#27272a', emissive: '#18181b', label: 'Alley', isWall: false, roadColor: '#1c1917' },
  PARK: { weight: 3, h: 0.30, color: '#166534', emissive: '#14532d', label: 'Park', isWall: false, roadColor: '#15803d' },
  BUILDING: { weight: Infinity, h: 3.5, color: '#1e3a5f', emissive: '#0c1a2e', label: 'Building', isWall: true, roadColor: null },
  TOWER: { weight: Infinity, h: 6.5, color: '#0f2744', emissive: '#060f1a', label: 'Tower', isWall: true, roadColor: null },
};

// ─── Asphalt Ground + Lane Markings ──────────────────────────────────────────
const AsphaltGround = () => {
  const size = GRID_SIZE * STEP + 6;
  const roadRows = [5, 10, 16];
  const roadCols = [5, 10, 16];

  return (
    <group>
      {/* Base asphalt — dark charcoal */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#18181b" roughness={0.98} metalness={0.02} />
      </mesh>

      {/* Main road lanes — horizontal (lighter asphalt strips) */}
      {roadRows.map(row => {
        const z = row * STEP - OFFSET + NODE_SIZE / 2;
        return (
          <mesh key={`rh-${row}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, z]}>
            <planeGeometry args={[size, STEP * 3]} />
            <meshStandardMaterial color="#27272a" roughness={0.95} />
          </mesh>
        );
      })}

      {/* Main road lanes — vertical */}
      {roadCols.map(col => {
        const x = col * STEP - OFFSET + NODE_SIZE / 2;
        return (
          <mesh key={`rv-${col}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.01, 0]}>
            <planeGeometry args={[STEP * 3, size]} />
            <meshStandardMaterial color="#27272a" roughness={0.95} />
          </mesh>
        );
      })}

      {/* Diagonal main road (GFGC → KCD direction) */}
      {Array.from({ length: GRID_SIZE }, (_, i) => {
        const x = i * STEP - OFFSET + NODE_SIZE / 2;
        const z = i * STEP - OFFSET + NODE_SIZE / 2;
        return (
          <mesh key={`diag-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.005, z]}>
            <planeGeometry args={[STEP * 2.5, STEP * 2.5]} />
            <meshStandardMaterial color="#3f3f46" roughness={0.9} />
          </mesh>
        );
      })}

      {/* Yellow centre-line dashes — horizontal roads */}
      {roadRows.map(row => {
        const z = row * STEP - OFFSET + NODE_SIZE / 2;
        return Array.from({ length: 10 }, (_, i) => (
          <mesh key={`yl-h-${row}-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[(i - 4.5) * (size / 10), 0.002, z]}>
            <planeGeometry args={[size / 14, 0.06]} />
            <meshStandardMaterial color="#ca8a04" roughness={1} transparent opacity={0.55} />
          </mesh>
        ));
      })}

      {/* Yellow centre-line dashes — vertical roads */}
      {roadCols.map(col => {
        const x = col * STEP - OFFSET + NODE_SIZE / 2;
        return Array.from({ length: 10 }, (_, i) => (
          <mesh key={`yl-v-${col}-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.002, (i - 4.5) * (size / 10)]}>
            <planeGeometry args={[0.06, size / 14]} />
            <meshStandardMaterial color="#ca8a04" roughness={1} transparent opacity={0.55} />
          </mesh>
        ));
      })}

      {/* White edge lines */}
      {roadRows.map(row => {
        const z = row * STEP - OFFSET + NODE_SIZE / 2;
        return [STEP * 1.4, -STEP * 1.4].map((dz, k) => (
          <mesh key={`wl-h-${row}-${k}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, z + dz]}>
            <planeGeometry args={[size, 0.04]} />
            <meshStandardMaterial color="#e4e4e7" roughness={1} transparent opacity={0.25} />
          </mesh>
        ));
      })}
    </group>
  );
};

// ─── Satellite Overlay ────────────────────────────────────────────────────────
const SatelliteOverlay = () => {
  const [texture, setTexture] = useState(null);
  useEffect(() => {
    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${CENTER_COORDS.lat},${CENTER_COORDS.lng}&zoom=16&size=1024x1024&maptype=satellite&style=feature:all|element:labels|visibility:off&key=${GOOGLE_MAPS_API_KEY}`;
    new THREE.TextureLoader().load(url, tex => setTexture(tex));
  }, []);
  if (!texture) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <planeGeometry args={[GRID_SIZE * STEP + 6, GRID_SIZE * STEP + 6]} />
      <meshStandardMaterial map={texture} roughness={1} transparent opacity={0.45} />
    </mesh>
  );
};

// ─── Per-Node Road Surface ────────────────────────────────────────────────────
const RoadSurface = ({ node }) => {
  const { terrain } = node;
  if (terrain.isWall) return null;
  const posX = node.col * STEP - OFFSET + NODE_SIZE / 2;
  const posZ = node.row * STEP - OFFSET + NODE_SIZE / 2;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[posX, 0.005, posZ]} receiveShadow>
      <planeGeometry args={[NODE_SIZE - 0.04, NODE_SIZE - 0.04]} />
      <meshStandardMaterial color={terrain.roadColor} roughness={0.92} metalness={0.0} />
    </mesh>
  );
};

// ─── 3D Node ──────────────────────────────────────────────────────────────────
const Node3D = ({ node, onToggleWall }) => {
  const meshRef = useRef();
  const { isWall, isStart, isEnd, isVisited, isPath, bfsVisited, bfsPath, terrain } = node;

  useEffect(() => {
    if (!meshRef.current) return;
    if ((isVisited || bfsVisited) && !isPath && !bfsPath && !isStart && !isEnd) {
      gsap.fromTo(meshRef.current.position, { y: -6 }, { y: terrain.h / 2, duration: 0.65, ease: 'power3.out' });
    }
    if (isPath || bfsPath) {
      gsap.to(meshRef.current.scale, { y: 2.8, duration: 0.35, ease: 'back.out(2)', yoyo: true, repeat: 1 });
    }
  }, [isVisited, isPath, bfsVisited, bfsPath]);

  // ── Sophisticated muted jewel-tone palette ──
  // Visited: low-saturation tones that read clearly without blinding bloom
  // Path:    warm gold (A*) and cool steel (BFS) — rich but not neon
  const COLOR = {
    start: '#0d9488', // deep teal
    end: '#be123c', // deep rose
    astarPath: '#92400e', // dark amber/bronze
    bfsPath: '#1e3a5f', // deep navy steel
    overlap: '#4c1d95', // deep violet
    astarVisit: '#44403c', // warm stone
    bfsVisit: '#1e293b', // cool slate
  };
  const EMISSIVE = {
    start: '#0f766e',
    end: '#9f1239',
    astarPath: '#78350f',
    bfsPath: '#172554',
    overlap: '#3b0764',
    astarVisit: '#292524',
    bfsVisit: '#0f172a',
  };

  const getColor = () => {
    if (isStart) return COLOR.start;
    if (isEnd) return COLOR.end;
    if (isPath && bfsPath) return COLOR.overlap;
    if (isPath) return COLOR.astarPath;
    if (bfsPath) return COLOR.bfsPath;
    if (isVisited && bfsVisited) return COLOR.overlap;
    if (isVisited) return COLOR.astarVisit;
    if (bfsVisited) return COLOR.bfsVisit;
    return terrain.color;
  };

  const getEmissive = () => {
    if (isStart) return EMISSIVE.start;
    if (isEnd) return EMISSIVE.end;
    if (isPath && bfsPath) return EMISSIVE.overlap;
    if (isPath) return EMISSIVE.astarPath;
    if (bfsPath) return EMISSIVE.bfsPath;
    if (isVisited && bfsVisited) return EMISSIVE.overlap;
    if (isVisited) return EMISSIVE.astarVisit;
    if (bfsVisited) return EMISSIVE.bfsVisit;
    return terrain.emissive;
  };

  const getEmissiveIntensity = () => {
    if (isStart || isEnd) return 1.2;
    if (isPath || bfsPath) return 0.9;
    if (isVisited || bfsVisited) return 0.5;
    return 0.2;
  };

  const height = terrain.h;
  const posX = node.col * STEP - OFFSET + NODE_SIZE / 2;
  const posZ = node.row * STEP - OFFSET + NODE_SIZE / 2;
  const isActive = isVisited || isPath || isStart || isEnd || bfsVisited || bfsPath;

  if (!isWall && !isActive) return null;

  return (
    <mesh
      ref={meshRef}
      position={[posX, height / 2, posZ]}
      castShadow={isWall}
      receiveShadow
      onPointerDown={e => { e.stopPropagation(); onToggleWall(node.row, node.col); }}
    >
      <boxGeometry args={[NODE_SIZE, height, NODE_SIZE]} />
      <meshStandardMaterial
        color={getColor()}
        emissive={getEmissive()}
        emissiveIntensity={getEmissiveIntensity()}
        roughness={isWall ? 0.3 : 0.55}
        metalness={isWall ? 0.7 : 0.3}
      />
    </mesh>
  );
};

// ─── Building Windows ─────────────────────────────────────────────────────────
const BuildingWindows = ({ node }) => {
  const { isWall, terrain } = node;
  if (!isWall) return null;
  const posX = node.col * STEP - OFFSET + NODE_SIZE / 2;
  const posZ = node.row * STEP - OFFSET + NODE_SIZE / 2;
  const floors = Math.floor(terrain.h / 1.2);
  return (
    <>
      {Array.from({ length: floors }, (_, f) => {
        const y = 0.7 + f * 1.2;
        const lit = (node.row * 7 + node.col * 3 + f * 11) % 5 !== 0;
        if (!lit) return null;
        return (
          <mesh key={f} position={[posX + NODE_SIZE / 2 + 0.01, y, posZ]}>
            <planeGeometry args={[0.22, 0.3]} />
            <meshStandardMaterial color="#d97706" emissive="#92400e" emissiveIntensity={0.8} side={THREE.FrontSide} />
          </mesh>
        );
      })}
    </>
  );
};

// ─── Path Line ────────────────────────────────────────────────────────────────
const PathLine = ({ nodes, color, dimColor }) => {
  const points = nodes.map(n => new THREE.Vector3(
    n.col * STEP - OFFSET + NODE_SIZE / 2, 2.0,
    n.row * STEP - OFFSET + NODE_SIZE / 2
  ));
  if (points.length < 2) return null;
  return <Line points={points} color={dimColor || color} lineWidth={3} />
};

// ─── Landmark Marker ──────────────────────────────────────────────────────────
const LandmarkMarker = ({ position, label, area, coords, color }) => (
  <group position={position}>
    <Float speed={1.8} floatIntensity={0.5} rotationIntensity={0.2}>
      <mesh position={[0, 7, 0]}>
        <octahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={10} />
      </mesh>
      <Html position={[0, 9.5, 0]} center distanceFactor={15}>
        <div style={{
          background: 'rgba(2,6,23,0.96)',
          border: `1.5px solid ${color}`,
          borderRadius: '0.85rem',
          padding: '0.6rem 1rem',
          color: 'white',
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.78rem',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          boxShadow: `0 0 30px ${color}55, 0 4px 20px rgba(0,0,0,0.8)`,
          pointerEvents: 'none',
        }}>
          <div style={{ color, marginBottom: '0.2rem', fontSize: '0.82rem' }}>{label}</div>
          <div style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: 500 }}>{area}</div>
          <div style={{ color: '#475569', fontSize: '0.6rem', marginTop: '0.15rem', fontFamily: 'JetBrains Mono, monospace' }}>{coords}</div>
        </div>
      </Html>
    </Float>
    <mesh position={[0, 3.5, 0]}>
      <cylinderGeometry args={[0.03, 0.03, 7]} />
      <meshStandardMaterial color={color} transparent opacity={0.6} />
    </mesh>
    {/* Glow ring */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
      <ringGeometry args={[0.8, 1.2, 32]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} transparent opacity={0.4} />
    </mesh>
  </group>
);

// ─── Cinematic Camera ─────────────────────────────────────────────────────────
const CinematicCamera = ({ pathNodes, isFlying, onFlyComplete }) => {
  const { camera } = useThree();
  const flyRef = useRef(isFlying);
  flyRef.current = isFlying;

  useEffect(() => {
    if (!isFlying || !pathNodes || pathNodes.length < 2) return;
    let idx = 0;
    const flyNext = () => {
      if (!flyRef.current || idx >= pathNodes.length) { onFlyComplete?.(); return; }
      const n = pathNodes[idx];
      const px = n.col * STEP - OFFSET + NODE_SIZE / 2;
      const pz = n.row * STEP - OFFSET + NODE_SIZE / 2;
      gsap.to(camera.position, {
        x: px + 8, y: 10, z: pz + 8,
        duration: 0.3, ease: 'power2.inOut',
        onUpdate: () => camera.lookAt(px, 0, pz),
        onComplete: () => { idx++; flyNext(); }
      });
    };
    flyNext();
  }, [isFlying, pathNodes]);

  return null;
};

// ─── Grid Creation ────────────────────────────────────────────────────────────
const createInitialGrid = (roadWeights = null) => {
  const grid = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    const currentRow = [];
    for (let col = 0; col < GRID_SIZE; col++) {
      const isStart = row === 2 && col === 2;
      const isEnd = row === GRID_SIZE - 3 && col === GRID_SIZE - 3;

      const onMainDiag = Math.abs(row - col) < 3;
      const onCrossH = row === 5 || row === 10 || row === 16;
      const onCrossV = col === 5 || col === 10 || col === 16;
      const isHighway = onMainDiag && (onCrossH || onCrossV);
      const isRoad = onMainDiag || onCrossH || onCrossV;
      const isAlley = !isRoad && (row % 4 === 0 || col % 4 === 0);
      const isPark = !isRoad && !isAlley && (row * 31 + col * 17) % 13 === 0;
      const isTower = !isStart && !isEnd && !isRoad && !isAlley && !isPark && (row * 13 + col * 7) % 6 === 0;
      const isBuilding = !isStart && !isEnd && !isRoad && !isAlley && !isPark && !isTower && (row * 5 + col * 11) % 3 !== 0;

      let terrain;
      if (isHighway) terrain = TERRAIN.HIGHWAY;
      else if (isRoad) terrain = TERRAIN.ROAD;
      else if (isAlley) terrain = TERRAIN.ALLEY;
      else if (isPark) terrain = TERRAIN.PARK;
      else if (isTower) terrain = TERRAIN.TOWER;
      else if (isBuilding) terrain = TERRAIN.BUILDING;
      else terrain = TERRAIN.ALLEY;

      let weight = terrain.weight;
      if (roadWeights && !terrain.isWall) {
        const { lat, lng } = gridToLatLng(row, col, GRID_SIZE);
        weight = getWeightForCoord(lat, lng, roadWeights);
      }

      currentRow.push({
        col, row, isStart, isEnd,
        distance: Infinity, isVisited: false,
        isWall: terrain.isWall,
        isPath: false, bfsVisited: false, bfsPath: false,
        previousNode: null, totalCost: Infinity, heuristic: 0,
        weight, terrain,
      });
    }
    grid.push(currentRow);
  }
  return grid;
};

// ─── Terrain Weight Legend (always visible panel) ─────────────────────────────
const TerrainPanel = () => (
  <div className="terrain-panel">
    <div className="terrain-panel-title"><Activity size={13} /> Terrain Weights</div>
    <div className="terrain-rows">
      {[
        { color: '#3f3f46', label: 'Highway / Main Road', weight: '×1', border: '#52525b' },
        { color: '#374151', label: 'Secondary Road', weight: '×1.5', border: '#4b5563' },
        { color: '#1c1917', label: 'Alley / Service', weight: '×2.5', border: '#292524' },
        { color: '#15803d', label: 'Park / Footway', weight: '×3', border: '#166534' },
        { color: '#1e3a5f', label: 'Building', weight: '∞', border: '#1e40af' },
      ].map(({ color, label, weight, border }) => (
        <div className="terrain-row-item" key={label}>
          <div className="terrain-swatch" style={{ background: color, borderColor: border }} />
          <span className="terrain-label">{label}</span>
          <span className="terrain-weight">{weight}</span>
        </div>
      ))}
    </div>
  </div>
);

// ─── Distance Info Panel ──────────────────────────────────────────────────────
const DistancePanel = ({ stats, algorithm, raceMode }) => {
  const astarDistKm = stats.astarPath > 0 ? (stats.astarPath * KM_PER_NODE).toFixed(2) : null;
  const bfsDistKm = stats.bfsPath > 0 ? (stats.bfsPath * KM_PER_NODE).toFixed(2) : null;
  const astarEta = astarDistKm ? Math.round((parseFloat(astarDistKm) / 30) * 60) : null; // 30 km/h avg
  const bfsEta = bfsDistKm ? Math.round((parseFloat(bfsDistKm) / 30) * 60) : null;

  return (
    <div className="distance-panel">
      <div className="dist-header">
        <Route size={13} />
        <span>Route Analysis</span>
      </div>
      <div className="dist-row">
        <span className="dist-label">Straight-line</span>
        <span className="dist-val">{STRAIGHT_LINE_KM.toFixed(2)} km</span>
      </div>
      {astarDistKm && (
        <div className="dist-row">
          <span className="dist-label" style={{ color: '#fbbf24' }}>A* Route</span>
          <span className="dist-val" style={{ color: '#fbbf24' }}>{astarDistKm} km · ~{astarEta} min</span>
        </div>
      )}
      {bfsDistKm && (
        <div className="dist-row">
          <span className="dist-label" style={{ color: '#60a5fa' }}>BFS Route</span>
          <span className="dist-val" style={{ color: '#60a5fa' }}>{bfsDistKm} km · ~{bfsEta} min</span>
        </div>
      )}
      <div className="dist-row" style={{ marginTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.4rem' }}>
        <span className="dist-label">Grid Scale</span>
        <span className="dist-val">{KM_PER_NODE.toFixed(3)} km/node</span>
      </div>
    </div>
  );
};

// ─── Algorithm Sidebar ────────────────────────────────────────────────────────
const AlgoSidebar = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState('bfs');
  return (
    <div className={`algo-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-header-left">
          <BookOpen size={16} style={{ color: 'var(--primary)' }} />
          <span>Algorithm Learning Center</span>
        </div>
        <button className="close-btn" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="sidebar-tabs">
        {['bfs', 'astar', 'race', 'credits'].map(t => (
          <button key={t} className={`stab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'bfs' ? 'BFS' : t === 'astar' ? 'A*' : t === 'race' ? '⚔ Race' : 'Credits'}
          </button>
        ))}
      </div>

      <div className="sidebar-body">
        {tab === 'bfs' && (
          <div className="scard">
            <div className="scard-badge bfs-badge"><Cpu size={11} /> Breadth-First Search</div>
            <p className="scard-desc">BFS explores all neighbors at the current depth before going deeper — like a ripple in water. It is <strong>blind</strong>: it has no idea where the goal is.</p>
            <div className="scard-formula">Queue: FIFO · No heuristic · Unweighted</div>
            <div className="sprop-list">
              <div className="sprop"><span>Shortest Path</span><span className="good">✓ Guaranteed</span></div>
              <div className="sprop"><span>Heuristic</span><span>None (Blind)</span></div>
              <div className="sprop"><span>Time</span><span className="warn">O(V + E)</span></div>
              <div className="sprop"><span>Space</span><span className="warn">O(V)</span></div>
              <div className="sprop"><span>Weighted</span><span className="bad">✗ No</span></div>
            </div>
            <p className="ssteps-title">Steps</p>
            <ol className="sstep-list">
              <li><span className="snum">1</span>Enqueue Start. Mark visited.</li>
              <li><span className="snum">2</span>Dequeue front node.</li>
              <li><span className="snum">3</span>If goal → backtrack path.</li>
              <li><span className="snum">4</span>Enqueue all unvisited neighbors.</li>
              <li><span className="snum">5</span>Repeat until queue empty.</li>
            </ol>
            <div className="sdivider" />
            <p className="suse">Real-world: Social networks, web crawlers, GPS on unweighted maps.</p>
          </div>
        )}

        {tab === 'astar' && (
          <div className="scard">
            <div className="scard-badge astar-badge"><Zap size={11} /> A* Search</div>
            <p className="scard-desc">A* uses a heuristic to <strong>estimate</strong> the remaining distance to the goal. It always expands the most promising node first.</p>
            <div className="scard-formula">f(n) = g(n) + h(n)<br />g(n) = actual cost · h(n) = Manhattan dist</div>
            <div className="sprop-list">
              <div className="sprop"><span>Shortest Path</span><span className="good">✓ Guaranteed</span></div>
              <div className="sprop"><span>Heuristic</span><span className="good">Manhattan Distance</span></div>
              <div className="sprop"><span>Time</span><span className="good">O(E log V)</span></div>
              <div className="sprop"><span>Weighted</span><span className="good">✓ Yes</span></div>
              <div className="sprop"><span>Road Data</span><span className="good">✓ OSM Weights</span></div>
            </div>
            <p className="ssteps-title">Terrain Weights</p>
            <div className="sterrain">
              {[
                { color: '#3f3f46', label: 'Highway / Main Road', w: '×1', b: '#52525b' },
                { color: '#374151', label: 'Secondary Road', w: '×1.5', b: '#4b5563' },
                { color: '#1c1917', label: 'Alley / Service', w: '×2.5', b: '#292524' },
                { color: '#15803d', label: 'Park / Footway', w: '×3', b: '#166534' },
                { color: '#1e3a5f', label: 'Building', w: '∞', b: '#1e40af' },
              ].map(({ color, label, w, b }) => (
                <div className="sterrain-row" key={label}>
                  <div className="sterrain-dot" style={{ background: color, borderColor: b }} />
                  <span>{label}</span>
                  <span className="sterrain-w">{w}</span>
                </div>
              ))}
            </div>
            <div className="sdivider" />
            <p className="suse">A* naturally prefers College Road (×1) over alleys (×2.5) — just like Google Maps!</p>
          </div>
        )}

        {tab === 'race' && (
          <div className="scard">
            <div className="scard-badge race-badge"><Swords size={11} /> Race Mode</div>
            <p className="scard-desc">Enable <strong>Race Mode</strong> to run BFS and A* simultaneously. Watch A* cut directly to KCD while BFS floods the entire map.</p>
            <div className="race-color-guide">
              {[
                { color: '#f59e0b', label: 'A* Explored' },
                { color: '#6366f1', label: 'BFS Explored' },
                { color: '#fbbf24', label: 'A* Path (Gold)' },
                { color: '#60a5fa', label: 'BFS Path (Blue)' },
                { color: '#a855f7', label: 'Overlap Zone' },
              ].map(({ color, label }) => (
                <div className="rcg-row" key={label}>
                  <div className="rcg-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="sdivider" />
            <div className="sprop-list">
              <div className="sprop"><span>BFS Nodes Explored</span><span className="warn">~60–80%</span></div>
              <div className="sprop"><span>A* Nodes Explored</span><span className="good">~20–40%</span></div>
              <div className="sprop"><span>Winner</span><span className="good">A* (always)</span></div>
            </div>
          </div>
        )}

        {tab === 'credits' && (
          <div className="scard">
            <div className="credit-hero">
              <div className="credit-avatar-lg">R</div>
              <div>
                <div className="credit-name-lg">Rohit Bagewadi</div>
                <div className="credit-role-lg">BCA Final Year · GFGC College, Dharwad</div>
              </div>
            </div>
            <p className="scard-desc" style={{ marginTop: '1rem' }}>
              This 3D pathfinding digital twin was designed and engineered to demonstrate
              <strong> BFS</strong> and <strong>A* Search</strong> algorithms on a real-world
              map of Dharwad, navigating from GFGC College (Kumareshwarnagar) to KCD Arts College.
            </p>
            <div className="sdivider" />
            <div className="sprop-list">
              <div className="sprop"><span>Project</span><span>PathfinderEDU</span></div>
              <div className="sprop"><span>Version</span><span>4.0 — Digital Twin</span></div>
              <div className="sprop"><span>Origin</span><span className="good">GFGC, Kumareshwarnagar</span></div>
              <div className="sprop"><span>Destination</span><span className="bad">KCD Arts College</span></div>
              <div className="sprop"><span>Distance</span><span>{STRAIGHT_LINE_KM.toFixed(2)} km (straight)</span></div>
              <div className="sprop"><span>Road Data</span><span>OpenStreetMap (OSM)</span></div>
              <div className="sprop"><span>3D Engine</span><span>React Three Fiber</span></div>
              <div className="sprop"><span>Maps</span><span>Google Maps Platform</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
const App = () => {
  const [roadData, setRoadData] = useState(null);
  const [roadStatus, setRoadStatus] = useState('loading');
  const [grid, setGrid] = useState(() => createInitialGrid(null));
  const [isRunning, setIsRunning] = useState(false);
  const [algorithm, setAlgorithm] = useState('A*');
  const [raceMode, setRaceMode] = useState(false);
  const [stats, setStats] = useState({ astarVisited: 0, bfsVisited: 0, astarPath: 0, bfsPath: 0, time: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [flyPath, setFlyPath] = useState(null);
  const [isFlying, setIsFlying] = useState(false);
  const [astarPathNodes, setAstarPathNodes] = useState([]);
  const [bfsPathNodes, setBfsPathNodes] = useState([]);

  useEffect(() => {
    fetchRoadNetwork().then(roads => {
      if (roads && roads.length > 0) {
        setRoadData(roads);
        setRoadStatus('loaded');
        setGrid(createInitialGrid(roads));
      } else {
        setRoadStatus('failed');
      }
    });
  }, []);

  const startX = 2 * STEP - OFFSET + NODE_SIZE / 2;
  const startZ = 2 * STEP - OFFSET + NODE_SIZE / 2;
  const endX = (GRID_SIZE - 3) * STEP - OFFSET + NODE_SIZE / 2;
  const endZ = (GRID_SIZE - 3) * STEP - OFFSET + NODE_SIZE / 2;

  const onToggleWall = useCallback((row, col) => {
    if (isRunning) return;
    setGrid(prev => {
      const next = prev.map(r => r.map(n => ({ ...n })));
      const node = next[row][col];
      if (node.isStart || node.isEnd) return prev;
      if (node.isWall) {
        node.isWall = false; node.terrain = TERRAIN.ROAD; node.weight = TERRAIN.ROAD.weight;
      } else {
        const t = (node.row + node.col) % 2 === 0 ? TERRAIN.TOWER : TERRAIN.BUILDING;
        node.isWall = true; node.terrain = t; node.weight = Infinity;
      }
      return next;
    });
  }, [isRunning]);

  const resetGrid = () => {
    setGrid(createInitialGrid(roadData));
    setStats({ astarVisited: 0, bfsVisited: 0, astarPath: 0, bfsPath: 0, time: 0 });
    setAstarPathNodes([]); setBfsPathNodes([]);
    setIsFlying(false); setFlyPath(null);
  };

  const runSimulation = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setAstarPathNodes([]); setBfsPathNodes([]);

    const makeClean = () => grid.map(r => r.map(n => ({
      ...n, isVisited: false, isPath: false, bfsVisited: false, bfsPath: false,
      distance: Infinity, previousNode: null, totalCost: Infinity, heuristic: 0,
    })));

    const t0 = performance.now();

    if (raceMode) {
      const gridA = makeClean(), gridB = makeClean();
      setGrid(makeClean());
      const aVis = astar(gridA, gridA[2][2], gridA[GRID_SIZE - 3][GRID_SIZE - 3]);
      const bVis = bfs(gridB, gridB[2][2], gridB[GRID_SIZE - 3][GRID_SIZE - 3]);
      const aPath = getNodesInShortestPathOrder(gridA[GRID_SIZE - 3][GRID_SIZE - 3]);
      const bPath = getNodesInShortestPathOrder(gridB[GRID_SIZE - 3][GRID_SIZE - 3]);
      const maxLen = Math.max(aVis.length, bVis.length);

      for (let i = 0; i < maxLen; i++) {
        await new Promise(r => setTimeout(r, 9));
        setGrid(prev => {
          const next = prev.map(r => [...r]);
          if (i < aVis.length) { const n = aVis[i]; next[n.row][n.col] = { ...next[n.row][n.col], isVisited: true }; }
          if (i < bVis.length) { const n = bVis[i]; next[n.row][n.col] = { ...next[n.row][n.col], bfsVisited: true }; }
          return next;
        });
        setStats(s => ({ ...s, astarVisited: Math.min(i + 1, aVis.length), bfsVisited: Math.min(i + 1, bVis.length) }));
      }
      for (let i = 0; i < Math.max(aPath.length, bPath.length); i++) {
        await new Promise(r => setTimeout(r, 20));
        setGrid(prev => {
          const next = prev.map(r => [...r]);
          if (i < aPath.length) { const n = aPath[i]; next[n.row][n.col] = { ...next[n.row][n.col], isPath: true }; }
          if (i < bPath.length) { const n = bPath[i]; next[n.row][n.col] = { ...next[n.row][n.col], bfsPath: true }; }
          return next;
        });
        setStats(s => ({ ...s, astarPath: Math.min(i + 1, aPath.length), bfsPath: Math.min(i + 1, bPath.length), time: Math.round(performance.now() - t0) }));
      }
      setAstarPathNodes(aPath); setBfsPathNodes(bPath);
      setFlyPath(aPath); setIsFlying(true);

    } else {
      const cg = makeClean();
      setGrid(cg);
      const vis = algorithm === 'BFS'
        ? bfs(cg, cg[2][2], cg[GRID_SIZE - 3][GRID_SIZE - 3])
        : astar(cg, cg[2][2], cg[GRID_SIZE - 3][GRID_SIZE - 3]);
      const path = getNodesInShortestPathOrder(cg[GRID_SIZE - 3][GRID_SIZE - 3]);

      for (let i = 0; i < vis.length; i++) {
        await new Promise(r => setTimeout(r, 7));
        const n = vis[i];
        setGrid(prev => {
          const next = prev.map(r => [...r]);
          if (algorithm === 'BFS') next[n.row][n.col] = { ...next[n.row][n.col], bfsVisited: true };
          else next[n.row][n.col] = { ...next[n.row][n.col], isVisited: true };
          return next;
        });
        setStats(s => ({ ...s, astarVisited: algorithm === 'A*' ? i + 1 : 0, bfsVisited: algorithm === 'BFS' ? i + 1 : 0 }));
      }

      if (path.length > 1 && path[path.length - 1].isEnd) {
        for (let i = 0; i < path.length; i++) {
          await new Promise(r => setTimeout(r, 22));
          const n = path[i];
          setGrid(prev => {
            const next = prev.map(r => [...r]);
            if (algorithm === 'BFS') next[n.row][n.col] = { ...next[n.row][n.col], bfsPath: true };
            else next[n.row][n.col] = { ...next[n.row][n.col], isPath: true };
            return next;
          });
          setStats(s => ({ ...s, astarPath: algorithm === 'A*' ? i + 1 : 0, bfsPath: algorithm === 'BFS' ? i + 1 : 0, time: Math.round(performance.now() - t0) }));
        }
        if (algorithm === 'A*') setAstarPathNodes(path); else setBfsPathNodes(path);
        setFlyPath(path); setIsFlying(true);
      }
    }
    setIsRunning(false);
  };

  return (
    <div className="app-root">
      <AlgoSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ── 3D Canvas ── */}
      <div className="canvas-wrap">
        <Canvas shadows camera={{ position: [26, 22, 26], fov: 42 }}>
          <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.1} />
          <Stars radius={100} depth={50} count={6000} factor={4} saturation={0} fade speed={0.8} />
          <ambientLight intensity={0.3} />
          <pointLight position={[20, 30, 20]} intensity={3} castShadow />
          <pointLight position={[-15, 12, -15]} intensity={1} color="#818cf8" />
          <Environment preset="night" />

          <CinematicCamera pathNodes={flyPath} isFlying={isFlying} onFlyComplete={() => setIsFlying(false)} />

          <AsphaltGround />
          <SatelliteOverlay />

          {grid.map((row, rIdx) => row.map((node, cIdx) => (
            <RoadSurface key={`rs-${rIdx}-${cIdx}`} node={node} />
          )))}

          <group>
            {grid.map((row, rIdx) => row.map((node, cIdx) => (
              <Node3D key={`n-${rIdx}-${cIdx}`} node={node} onToggleWall={onToggleWall} />
            )))}
          </group>

          {grid.map((row, rIdx) => row.map((node, cIdx) => (
            <BuildingWindows key={`bw-${rIdx}-${cIdx}`} node={node} />
          )))}

          {astarPathNodes.length > 1 && <PathLine nodes={astarPathNodes} color="#92400e" dimColor="#b45309" />}
          {bfsPathNodes.length > 1 && <PathLine nodes={bfsPathNodes} color="#1e3a5f" dimColor="#1d4ed8" />}

          <LandmarkMarker
            position={[startX, 0, startZ]}
            label="🎓 GFGC College"
            area="Kumareshwarnagar, Dharwad"
            coords={`${GFGC_COORDS.lat}°N ${GFGC_COORDS.lng}°E`}
            color="#0d9488"
          />
          <LandmarkMarker
            position={[endX, 0, endZ]}
            label="🎓 KCD Arts College"
            area="Dharwad"
            coords={`${KCD_COORDS.lat}°N ${KCD_COORDS.lng}°E`}
            color="#be123c"
          />

          <EffectComposer>
            <Bloom luminanceThreshold={1.4} intensity={0.6} radius={0.4} />
            <ChromaticAberration offset={[0.0003, 0.0003]} />
            <Vignette darkness={0.45} />
          </EffectComposer>
        </Canvas>
      </div>

      {/* ── UI Overlay ── */}
      <div className="ui-overlay">

        {/* ── Top Navbar ── */}
        <header className="topbar">
          <div className="topbar-brand">
            <div className="brand-icon"><GraduationCap size={20} /></div>
            <div className="brand-text">
              <span className="brand-name">PathfinderEDU</span>
              <span className="brand-sub">Dharwad Digital Twin · v4.0</span>
            </div>
          </div>

          <div className="topbar-center">
            <div className="route-chip">
              <MapPin size={11} style={{ color: '#10b981' }} />
              <span>GFGC, Kumareshwarnagar</span>
              <ChevronRight size={11} style={{ color: '#475569' }} />
              <MapPin size={11} style={{ color: '#f43f5e' }} />
              <span>KCD Arts College</span>
              <span className="route-dist">{STRAIGHT_LINE_KM.toFixed(2)} km</span>
            </div>
          </div>

          <div className="topbar-right">
            <div className={`osm-badge ${roadStatus}`}>
              {roadStatus === 'loading' && <><Wifi size={11} className="spin" /> Loading OSM…</>}
              {roadStatus === 'loaded' && <><Wifi size={11} /> OSM Active</>}
              {roadStatus === 'failed' && <><WifiOff size={11} /> Procedural</>}
            </div>
            <button className="icon-btn" onClick={() => setSidebarOpen(v => !v)} title="Algorithm Learning Center">
              <BookOpen size={17} />
            </button>
          </div>
        </header>

        {/* ── Left Panel: Controls ── */}
        <aside className="left-panel">
          <div className="panel-section">
            <label className="panel-label"><Zap size={12} /> Algorithm</label>
            <div className="algo-selector">
              {['A*', 'BFS'].map(alg => (
                <button
                  key={alg}
                  className={`algo-btn ${algorithm === alg && !raceMode ? 'active' : ''}`}
                  onClick={() => { if (!isRunning && !raceMode) setAlgorithm(alg); }}
                  disabled={isRunning || raceMode}
                >
                  {alg === 'A*' ? <Zap size={13} /> : <Cpu size={13} />}
                  {alg === 'A*' ? 'A* Weighted' : 'BFS Blind'}
                </button>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <label className="panel-label"><Swords size={12} /> Race Mode</label>
            <div className="race-toggle-row" onClick={() => !isRunning && setRaceMode(v => !v)}>
              <div className={`toggle-pill ${raceMode ? 'on' : ''}`}>
                <div className="toggle-thumb" />
              </div>
              <span className="toggle-label">{raceMode ? 'BFS vs A* — Active' : 'Run both simultaneously'}</span>
            </div>
          </div>

          <div className="panel-section panel-actions">
            <button className="run-btn" onClick={runSimulation} disabled={isRunning}>
              <Navigation size={16} />
              {isRunning ? 'Simulating…' : raceMode ? 'Start Race!' : 'Find Route'}
            </button>
            <button className="reset-btn" onClick={resetGrid} disabled={isRunning}>
              <RotateCcw size={15} /> Reset
            </button>
          </div>

          {/* Stats */}
          <div className="panel-section">
            <label className="panel-label"><BarChart2 size={12} /> Live Stats</label>
            <div className="stats-grid">
              {(raceMode || algorithm === 'A*') && (
                <div className="stat-tile amber">
                  <span className="st-label">A* Explored</span>
                  <span className="st-val">{stats.astarVisited}</span>
                </div>
              )}
              {(raceMode || algorithm === 'BFS') && (
                <div className="stat-tile indigo">
                  <span className="st-label">BFS Explored</span>
                  <span className="st-val">{stats.bfsVisited}</span>
                </div>
              )}
              {stats.astarPath > 0 && (
                <div className="stat-tile gold">
                  <span className="st-label">A* Path</span>
                  <span className="st-val">{stats.astarPath}<small>u</small></span>
                </div>
              )}
              {stats.bfsPath > 0 && (
                <div className="stat-tile blue">
                  <span className="st-label">BFS Path</span>
                  <span className="st-val">{stats.bfsPath}<small>u</small></span>
                </div>
              )}
              <div className="stat-tile neutral">
                <span className="st-label"><Clock size={10} /> Time</span>
                <span className="st-val">{stats.time}<small>ms</small></span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Right Panel: Terrain + Distance ── */}
        <aside className="right-panel">
          <TerrainPanel />
          <DistancePanel stats={stats} algorithm={algorithm} raceMode={raceMode} />
        </aside>

        {/* ── Bottom Hint ── */}
        <div className="bottom-hint">
          <MousePointerClick size={12} />
          <span><strong>Click</strong> node → toggle building &nbsp;·&nbsp; <strong>Drag</strong> → orbit &nbsp;·&nbsp; <strong>Scroll</strong> → zoom</span>
        </div>

        {/* ── Node Color Legend ── */}
        <div className="node-legend">
          {[
            { color: '#0d9488', label: 'GFGC (Start)' },
            { color: '#be123c', label: 'KCD (End)' },
            { color: '#44403c', label: 'A* Visited' },
            { color: '#1e293b', label: 'BFS Visited' },
            { color: '#92400e', label: 'A* Path' },
            { color: '#1e3a5f', label: 'BFS Path' },
            { color: '#4c1d95', label: 'Overlap' },
          ].map(({ color, label }) => (
            <div className="nl-item" key={label}>
              <div className="nl-dot" style={{ background: color, border: `1px solid ${color}88` }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
