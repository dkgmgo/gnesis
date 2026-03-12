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