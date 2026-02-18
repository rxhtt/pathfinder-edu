/**
 * Smart Heuristics via Google Routes API
 * Fetches real road-type data for the Dharwad area to assign
 * terrain weights to grid nodes based on actual road classification.
 */

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Dharwad bounding box
const BOUNDS = {
    north: 15.4750,
    south: 15.4480,
    east: 75.0050,
    west: 74.9850,
};

// Road type → terrain weight mapping (mirrors A* cost)
const ROAD_TYPE_WEIGHTS = {
    'motorway': 1,
    'trunk': 1,
    'primary': 1,   // College Road, main arteries
    'secondary': 1.5,
    'tertiary': 2,
    'residential': 2.5,
    'service': 3,
    'unclassified': 3,
    'path': 4,
    'footway': 4,
    'default': 2,
};

/**
 * Fetches road network from OpenStreetMap Overpass API for the Dharwad area.
 * Returns an array of road segments with their type and coordinates.
 * We use OSM instead of Google Routes API because Routes API is for
 * point-to-point routing, not bulk road-type extraction.
 */
export async function fetchRoadNetwork() {
    const query = `
    [out:json][timeout:25];
    (
      way["highway"](${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east});
    );
    out body;
    >;
    out skel qt;
  `;

    try {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
        const data = await res.json();
        return parseOSMData(data);
    } catch (err) {
        console.warn('[RoadNetwork] Overpass API unavailable, using fallback weights:', err.message);
        return null;
    }
}

function parseOSMData(data) {
    const nodes = {};
    const roads = [];

    // Index all node positions
    for (const el of data.elements) {
        if (el.type === 'node') {
            nodes[el.id] = { lat: el.lat, lng: el.lon };
        }
    }

    // Extract road segments
    for (const el of data.elements) {
        if (el.type === 'way' && el.tags?.highway) {
            const highway = el.tags.highway;
            const weight = ROAD_TYPE_WEIGHTS[highway] ?? ROAD_TYPE_WEIGHTS.default;
            const coords = el.nodes
                .map(id => nodes[id])
                .filter(Boolean);

            if (coords.length >= 2) {
                roads.push({ highway, weight, coords, name: el.tags.name || '' });
            }
        }
    }

    return roads;
}

/**
 * Given a grid node's lat/lng, find the nearest road segment
 * and return its weight. Used to assign real terrain costs.
 */
export function getWeightForCoord(lat, lng, roads) {
    if (!roads || roads.length === 0) return 2;

    let minDist = Infinity;
    let bestWeight = 2;

    for (const road of roads) {
        for (let i = 0; i < road.coords.length - 1; i++) {
            const a = road.coords[i];
            const b = road.coords[i + 1];
            const dist = pointToSegmentDist(lat, lng, a.lat, a.lng, b.lat, b.lng);
            if (dist < minDist) {
                minDist = dist;
                bestWeight = road.weight;
            }
        }
    }

    // If within ~30m of a road, use road weight; otherwise treat as alley/building
    const ROAD_SNAP_THRESHOLD = 0.0003; // ~33m in degrees
    return minDist < ROAD_SNAP_THRESHOLD ? bestWeight : 3;
}

function pointToSegmentDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Maps a grid (row, col) to real-world lat/lng in the Dharwad area.
 */
export function gridToLatLng(row, col, gridSize) {
    const latRange = BOUNDS.north - BOUNDS.south;
    const lngRange = BOUNDS.east - BOUNDS.west;
    return {
        lat: BOUNDS.north - (row / gridSize) * latRange,
        lng: BOUNDS.west + (col / gridSize) * lngRange,
    };
}
