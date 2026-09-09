import test from 'node:test';
import assert from 'node:assert/strict';

import { closeness_centrality } from '../back_utils.js';
import { snapshot, path3, star4, k4, triangle_plus_pair, triangle_pair_isolate, grid} from './fixtures.js';

// closeness_centrality writes _closeness onto the nodes it is given
function scores(snap) {
    closeness_centrality(snap);
    return snap.nodes.map(node => node._closeness);
}

function assert_close(actual, expected, msg, eps = 1e-9) {
    assert.ok(Math.abs(actual - expected) <= eps,
        `${msg}: expected ${expected}, got ${actual}`);
}

// ---------------------------------------------------------------- values

test('path graph: centre scores 1, endpoints 2/3', () => {
    const c = scores(path3());
    assert_close(c[1], 1, 'centre');
    assert_close(c[0], 2/3, 'left endpoint');
    assert_close(c[2], 2/3, 'right endpoint');
});

test('star graph: hub scores 1, leaves 3/5', () => {
    const c = scores(star4());
    assert_close(c[0], 1, 'hub');
    for (const leaf of [1, 2, 3]) assert_close(c[leaf], 3/5, `leaf ${leaf}`);
});

test('complete graph: every node scores 1', () => {
    for (const c of scores(k4())) assert_close(c, 1, 'K4 node');
});

test('scores never exceed 1', () => {
    const all = [
        ...scores(path3()), ...scores(star4()),
        ...scores(k4()), ...scores(triangle_plus_pair())
    ];
    for (const c of all) assert.ok(c <= 1 + 1e-12, `score ${c} exceeds 1`);
});

// ------------------------------------------------------- disconnected graphs

test('isolated node scores 0, not Infinity', () => {
    const c = scores(snapshot(3, [[0,1]])); // node 2 is isolated
    assert.ok(Number.isFinite(c[2]), `isolated node scored ${c[2]}`);
    assert_close(c[2], 0, 'isolated node');
});

test('every score stays finite when the graph is disconnected', () => {
    for (const c of scores(triangle_pair_isolate())) {
        assert.ok(Number.isFinite(c), `non-finite score ${c}`);
    }
});

test('a large component outranks a small one', () => {
    // Regression: unnormalized 1/sum scored the 2-node component higher (1.0)
    // than the triangle (0.5), putting the hub highlight on the smaller island.
    const c = scores(triangle_plus_pair());
    assert_close(c[0], 0.5, 'triangle node');
    assert_close(c[3], 0.25, 'disjoint-pair node');
    assert.ok(c[0] > c[3], `triangle ${c[0]} should outrank pair ${c[3]}`);
});

test('component size, not just distance, decides the ranking', () => {
    // Every node here is one hop from everything it can reach, so a purely
    // within-component metric would tie them. Only the size factor separates them.
    const c = scores(triangle_pair_isolate());
    assert.ok(c[0] > c[3], 'triangle node should outrank pair node');
    assert.ok(c[3] > c[5], 'pair node should outrank isolated node');
});

// ------------------------------------------------------------- degenerate

test('single-node graph scores 0 without dividing by zero', () => {
    const c = scores(snapshot(1, []));
    assert.ok(Number.isFinite(c[0]), `scored ${c[0]}`);
    assert_close(c[0], 0, 'lone node');
});

test('edgeless graph scores every node 0', () => {
    for (const c of scores(snapshot(4, []))) assert_close(c, 0, 'edgeless node');
});

test('empty graph does not throw', () => {
    const snap = snapshot(0, []);
    closeness_centrality(snap);
    assert.equal(snap.nodes.length, 0);
});

// -------------------------------------------------------------- structure

test('grid centre outranks its corners', () => {
    const cols = 5;
    const c = scores(grid(5, cols));
    const centre = c[2 * cols + 2];
    assert_close(centre, Math.max(...c), 'centre should be the maximum');
    assert.ok(centre > c[0], `centre ${centre} should outrank corner ${c[0]}`);
});

test('adding an edge never lowers a score', () => {
    const before = scores(snapshot(4, [[0,1],[1,2]]));
    const after  = scores(snapshot(4, [[0,1],[1,2],[2,3]]));
    for (let i = 0; i < 3; i++) {
        assert.ok(after[i] >= before[i] - 1e-12,
            `node ${i} fell from ${before[i]} to ${after[i]}`);
    }
});
