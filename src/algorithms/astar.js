/**
 * Weighted A* Search Algorithm
 * Supports node weights (terrain cost) for realistic pathfinding.
 * g(n) = actual cost (with terrain weight)
 * h(n) = Manhattan distance heuristic
 * f(n) = g(n) + h(n)
 */
export function astar(grid, startNode, endNode) {
    const visitedNodesInOrder = [];
    startNode.distance = 0;
    startNode.totalCost = heuristic(startNode, endNode);

    // Min-heap simulation via sorted array (open list)
    const openList = [startNode];
    const closedSet = new Set();

    while (openList.length > 0) {
        // Sort by f(n) — pick best candidate
        openList.sort((a, b) => a.totalCost - b.totalCost);
        const current = openList.shift();

        if (current.isWall) continue;
        if (closedSet.has(current)) continue;
        if (current.distance === Infinity) return visitedNodesInOrder;

        closedSet.add(current);
        current.isVisited = true;
        visitedNodesInOrder.push(current);

        if (current === endNode) return visitedNodesInOrder;

        const neighbors = getNeighbors(current, grid);
        for (const neighbor of neighbors) {
            if (closedSet.has(neighbor) || neighbor.isWall) continue;

            // g(n): actual cost = parent cost + terrain weight of neighbor
            const tentativeG = current.distance + (neighbor.weight || 1);

            if (tentativeG < neighbor.distance) {
                neighbor.distance = tentativeG;
                neighbor.heuristic = heuristic(neighbor, endNode);
                neighbor.totalCost = neighbor.distance + neighbor.heuristic;
                neighbor.previousNode = current;

                if (!openList.includes(neighbor)) {
                    openList.push(neighbor);
                }
            }
        }
    }

    return visitedNodesInOrder;
}

function heuristic(nodeA, nodeB) {
    // Manhattan distance — admissible for grid movement
    return Math.abs(nodeA.row - nodeB.row) + Math.abs(nodeA.col - nodeB.col);
}

function getNeighbors(node, grid) {
    const { col, row } = node;
    const neighbors = [];
    if (row > 0) neighbors.push(grid[row - 1][col]);
    if (row < grid.length - 1) neighbors.push(grid[row + 1][col]);
    if (col > 0) neighbors.push(grid[row][col - 1]);
    if (col < grid[0].length - 1) neighbors.push(grid[row][col + 1]);
    return neighbors;
}
