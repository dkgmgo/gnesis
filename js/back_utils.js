export function mulberry32(seed) {
    return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

export function closeness_centrality(snapshot) {
    all_pairs_sssp(snapshot);
    for (const node of snapshot.nodes) {
        const dist = snapshot.all_pairs_sssp[node.id]
        const sumDist = Object.values(dist).reduce((a,b) => a+b, 0);
        node._closeness = 1.0 / sumDist;
    }
}

export function ollivier_ricci_curvature(snapshot){
    all_pairs_sssp(snapshot);
    for (const edge of snapshot.edges){
        const muU = get_distribution(snapshot.adj[edge.source], edge.source);
        const muV = get_distribution(snapshot.adj[edge.target], edge.target);
        const w1 = sinkhorn(muU, muV, snapshot.all_pairs_sssp);
        edge._curv = parseFloat((1 - w1).toFixed(4)); //unweighted
    }
}

function sinkhorn(muX, muY, distMatrix, lambda = 20, maxIter = 100, tol = 1e-9) {
    const sources = Object.keys(muX);
    const targets = Object.keys(muY);
    const n = sources.length, m = targets.length;

    const K = Array.from({length: n}, (_, i) =>
        Array.from({length: m}, (_, j) => {
            const d = distMatrix[sources[i]]?.[targets[j]] ?? Infinity;
            return Math.exp(-lambda * d);
        })
    );

    const a = sources.map(u => muX[u]);
    const b = targets.map(v => muY[v]);

    let u = new Array(n).fill(1);
    let v = new Array(m).fill(1);

    for (let iter = 0; iter < maxIter; iter++) {
        const prevU = [...u];

        v = b.map((bj, j) => {
            const denom = u.reduce((sum, ui, i) => sum + ui * K[i][j], 0);
            return denom > 0 ? bj / denom : 0;
        });

        u = a.map((ai, i) => {
            const denom = v.reduce((sum, vj, j) => sum + K[i][j] * vj, 0);
            return denom > 0 ? ai / denom : 0;
        });

        const err = u.reduce((s, ui, i) => s + Math.abs(ui - prevU[i]), 0);
        if (err < tol) break;
    }

    let w1 = 0;
    for (let i = 0; i < n; i++){
        for (let j = 0; j < m; j++) {
            const d = distMatrix[sources[i]]?.[targets[j]] ?? 1;
            w1 += u[i] * K[i][j] * v[j] * d;
        }
    }

    return w1;
}

function get_distribution(neighbors, node, alpha = 0.0){
    const deg = neighbors.length;

    if(deg === 0){
        return {[node] : 1};
    }
    const mu = {[node]: alpha};
    const shared = (1 - alpha) / deg;
    for(const nei of neighbors){
        mu[nei] = shared;
    }
    return mu;
}

function all_pairs_sssp(snapshot){
    if (!snapshot.all_pairs_sssp){
        adjacency(snapshot);
        let dist = {};
        for(const node of snapshot.nodes){
            dist[node.id] = bfs(snapshot, node.id);
        }
        snapshot.all_pairs_sssp = dist;
    }
}

function bfs(snapshot, startId) {
    const queue = [startId];
    const dist = {};
    dist[startId] = 0;

    while (queue.length > 0) {
        const current = queue.shift();
        const currentDist = dist[current];

        for (const neighbor of snapshot.adj[current]) {
            if (!(neighbor in dist)) {
                dist[neighbor] = currentDist + 1;
                queue.push(neighbor);
            }
        }
    }
    return dist;
}

function adjacency(snapshot){
    if(!snapshot.adj){
        const adj = {};
        for (const node of snapshot.nodes) adj[node.id] = [];
        for (const edge of snapshot.edges) {
            adj[edge.source].push(edge.target);
            adj[edge.target].push(edge.source);
        }
        snapshot.adj = adj;
    }
}