export function mulberry32(seed) {
    return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

export function closeness_centrality(snapshot) {
    for (const node of snapshot.nodes) {
        const dist = bfs(snapshot, node.id);
        const sumDist = Object.values(dist).reduce((a,b) => a+b, 0);
        node._closeness = 1.0 / sumDist;
    }
}

function bfs(snapshot, startId) {
    const queue = [startId];
    const dist = {};
    dist[startId] = 0;

    while (queue.length > 0) {
        const current = queue.shift();
        const currentDist = dist[current];

        for (const edge of snapshot.edges) {
            let neighbor = null;
            if (edge.source === current) neighbor = edge.target;
            else if (edge.target === current) neighbor = edge.source;

            if (neighbor !== null && !(neighbor in dist)) {
                dist[neighbor] = currentDist + 1;
                queue.push(neighbor);
            }
        }
    }
    return dist;
}