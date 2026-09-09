// Small graphs with hand-checkable structure, shared across test files.

export function snapshot(n, edge_pairs) {
    return {
        nodes: Array.from({ length: n }, (_, i) => ({ id: i })),
        edges: edge_pairs.map(([source, target]) => ({ source, target }))
    };
}

// 0 - 1 - 2
export const path3 = () => snapshot(3, [[0,1],[1,2]]);

// hub 0, leaves 1..3
export const star4 = () => snapshot(4, [[0,1],[0,2],[0,3]]);

export const k4 = () => snapshot(4, [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]);

// triangle {0,1,2} and a disjoint pair {3,4}
export const triangle_plus_pair = () => snapshot(5, [[0,1],[1,2],[0,2],[3,4]]);

// triangle {0,1,2}, pair {3,4}, isolated node 5
export const triangle_pair_isolate = () => snapshot(6, [[0,1],[0,2],[1,2],[3,4]]);

export function grid(rows, cols) {
    const edges = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const id = r * cols + c;
            if (c > 0) edges.push([id - 1, id]);
            if (r > 0) edges.push([id - cols, id]);
        }
    }
    return snapshot(rows * cols, edges);
}
