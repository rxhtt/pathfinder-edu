/**
 * Breadth-First Search (BFS)
 * Unweighted, exhaustive, layer-by-layer exploration.
 * Guarantees shortest path in unweighted grids.
 */
export function bfs(grid, startNode, endNode) {
    const visitedNodesInOrder = [];
    const queue = [startNode];
    startNode.isVisited = true;

    while (queue.length > 0) {
        const current = queue.shift();
        if (current.isWall) continue;
        visitedNodesInOrder.push(current);
        if (current === endNode) return visitedNodesInOrder;

        const neighbors = getUnvisitedNeighbors(current, grid);
        for (const neighbor of neighbors) {
            neighbor.isVisited = true;
            neighbor.previousNode = current;
            queue.push(neighbor);
        }
    }
    return visitedNodesInOrder;
}

function getUnvisitedNeighbors(node, grid) {
    const { col, row } = node;
    const neighbors = [];
    if (row > 0) neighbors.push(grid[row - 1][col]);
    if (row < grid.length - 1) neighbors.push(grid[row + 1][col]);
    if (col > 0) neighbors.push(grid[row][col - 1]);
    if (col < grid[0].length - 1) neighbors.push(grid[row][col + 1]);
    return neighbors.filter(n => !n.isVisited && !n.isWall);
}

export function getNodesInShortestPathOrder(endNode) {
    const path = [];
    let current = endNode;
    while (current !== null && current !== undefined) {
        path.unshift(current);
        current = current.previousNode;
    }
    return path;
}
