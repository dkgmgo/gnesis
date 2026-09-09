import test from 'node:test';
import assert from 'node:assert/strict';

import { graph_from_graphml_doc } from '../files/graphml.js';

// node has no DOMParser, so a small element tree stands in for a Document.
// It models exactly what the importer touches: getAttribute, children,
// localName, textContent and getElementsByTagNameNS.
function E(localName, attrs = {}, kids = [], text = null) {
    return {
        localName,
        children: kids,
        get textContent() { return text ?? kids.map(k => k.textContent).join(''); },
        getAttribute: k => (k in attrs ? attrs[k] : null),
        getElementsByTagNameNS(_ns, name) {
            const out = [];
            (function walk(els) {
                for (const c of els) { if (c.localName === name) out.push(c); walk(c.children); }
            })(this.children);
            return out;
        }
    };
}

const D = (key, value) => E('data', { key }, [], value);
const KEY = (id, domain, name, def) =>
    E('key', { id, for: domain, 'attr.name': name }, def == null ? [] : [E('default', {}, [], def)]);

function doc({ keys = [], nodes = [], edges = [], edgedefault = 'undirected', graphs = 1, hyper = 0 }) {
    const node_el = n => typeof n === 'object' && n !== null
        ? E('node', n.id === undefined ? {} : { id: n.id },
            Object.entries(n.data ?? {}).map(([k, v]) => D(k, v)).concat(n.kids ?? []))
        : E('node', n === null ? {} : { id: n });
    const edge_el = e => e?.localName ? e : Array.isArray(e)
        ? E('edge', {
            ...(e[0] === undefined ? {} : { source: e[0] }),
            ...(e[1] === undefined ? {} : { target: e[1] })
          })
        : E('edge', { source: e.source, target: e.target },
            Object.entries(e.data ?? {}).map(([k, v]) => D(k, v)));
    const graph = E('graph', { edgedefault },
        [...nodes.map(node_el), ...edges.map(edge_el),
         ...Array.from({ length: hyper }, () => E('hyperedge'))]);
    return E('graphml', {}, [...keys, ...Array.from({ length: graphs }, () => graph)]);
}

const labels = g => g.nodes.map(n => n.label);
const wire = g => g.edges.map(e => `${e.source}-${e.target}`);
const warned = (g, re) => g.warnings.some(w => re.test(w));

// ------------------------------------------------------------- id remapping

test('string ids are remapped to a dense 0..n-1 range', () => {
    const g = graph_from_graphml_doc(doc({
        nodes: ['n0', 'n7', 'alpha'], edges: [['n0', 'alpha'], ['n7', 'n0']]
    }));
    assert.deepEqual(g.nodes.map(n => n.id), [0, 1, 2]);
    assert.deepEqual(g.nodes.map(n => n.gid), ['n0', 'n7', 'alpha']);
    assert.deepEqual(wire(g), ['0-2', '1-0']);
});

test('every edge endpoint exists in nodes', () => {
    const g = graph_from_graphml_doc(doc({
        nodes: ['a', 'b', 'c'], edges: [['a', 'b'], ['b', 'c'], ['c', 'a']]
    }));
    const ids = new Set(g.nodes.map(n => n.id));
    for (const e of g.edges) assert.ok(ids.has(e.source) && ids.has(e.target));
});

// ------------------------------------------------------- attributes in <data>

test('node label comes from the name attribute', () => {
    const g = graph_from_graphml_doc(doc({
        keys: [KEY('k1', 'node', 'name')],
        nodes: [{ id: 'n0', data: { k1: 'Telecom Infrastructure Co' } }, 'n1']
    }));
    assert.deepEqual(labels(g), ['Telecom Infrastructure Co', 'n1']);
    assert.equal(g.nodes[0].gid, 'n0', 'the GraphML id is still kept');
    assert.equal(g.read.labels, 1);
});

test('Name and name collide on case; the first non-empty wins', () => {
    const g = graph_from_graphml_doc(doc({
        keys: [KEY('k1', 'node', 'Name'), KEY('k16', 'node', 'name')],
        nodes: [{ id: 'n0', data: { k1: '', k16: 'lowercase wins when Name is blank' } },
                { id: 'n1', data: { k1: 'Name wins when present', k16: 'ignored' } }]
    }));
    assert.deepEqual(labels(g), ['lowercase wins when Name is blank', 'Name wins when present']);
});

test('edge curvature and distance are read from the file', () => {
    const g = graph_from_graphml_doc(doc({
        keys: [KEY('k11', 'edge', 'curv'), KEY('k13', 'edge', 'distance')],
        nodes: ['a', 'b'],
        edges: [{ source: 'a', target: 'b', data: { k11: '-0.492322', k13: '0.841348' } }]
    }));
    assert.equal(g.edges[0]._curv, -0.492322);
    assert.equal(g.edges[0]._distance, 0.841348);
    assert.deepEqual(g.read, { labels: 0, curv: 1, distance: 1 });
});

test('an edge with no curv in the file is left for the metrics panel', () => {
    const g = graph_from_graphml_doc(doc({
        keys: [KEY('k11', 'edge', 'curv')],
        nodes: ['a', 'b', 'c'],
        edges: [{ source: 'a', target: 'b', data: { k11: '-0.49' } }, ['b', 'c']]
    }));
    assert.equal(g.edges[0]._curv, -0.49, 'present in the file, kept');
    assert.equal(g.edges[1]._curv, undefined, 'absent, so left to be computed');
    assert.equal(g.read.curv, 1);
});

test('two keys may declare the same attr.name', () => {
    // some real files do this: key12 and key13 are both attr.name="distance"
    const g = graph_from_graphml_doc(doc({
        keys: [KEY('k12', 'edge', 'distance'), KEY('k13', 'edge', 'distance')],
        nodes: ['a', 'b'],
        edges: [{ source: 'a', target: 'b', data: { k13: '0.84' } }]
    }));
    assert.equal(g.edges[0]._distance, 0.84);
});

test('a repeated <data> for one key keeps the first non-empty value', () => {
    const g = graph_from_graphml_doc(doc({
        keys: [KEY('k11', 'edge', 'curv')],
        nodes: ['a', 'b'],
        edges: [E('edge', { source: 'a', target: 'b' }, [D('k11', '-0.5'), D('k11', '-0.5')])]
    }));
    assert.equal(g.edges[0]._curv, -0.5);
});

test('<key> defaults apply where an element carries no data', () => {
    const g = graph_from_graphml_doc(doc({
        keys: [KEY('k11', 'edge', 'curv', '0.25')],
        nodes: ['a', 'b'], edges: [{ source: 'a', target: 'b' }]
    }));
    assert.equal(g.edges[0]._curv, 0.25);
});

test('non-numeric and absent values leave the field unset', () => {
    const g = graph_from_graphml_doc(doc({
        keys: [KEY('k11', 'edge', 'curv')],
        nodes: ['a', 'b', 'c'],
        edges: [{ source: 'a', target: 'b', data: { k11: 'n/a' } }, ['b', 'c']]
    }));
    assert.equal(g.edges[0]._curv, undefined, 'garbage is not coerced to NaN');
    assert.equal(g.edges[1]._curv, undefined);
    assert.equal(g.read.curv, 0);
});

test('a nested graph does not leak its data into the outer node', () => {
    const inner = E('graph', {}, [E('node', { id: 'inner' }, [D('k1', 'inner name')])]);
    const g = graph_from_graphml_doc(doc({
        keys: [KEY('k1', 'node', 'name')],
        nodes: [{ id: 'outer', kids: [inner] }]
    }));
    assert.equal(g.nodes[0].label, 'outer', 'outer node keeps its own id as label');
});

// -------------------------------------------------------- recoverable input

test('endpoint referenced but never declared is added and reported', () => {
    const g = graph_from_graphml_doc(doc({ nodes: ['a'], edges: [['a', 'ghost']] }));
    assert.equal(g.nodes.length, 2);
    assert.equal(g.nodes[1].label, 'ghost');
    assert.ok(warned(g, /never declared/));
});

test('self-loops are dropped and reported', () => {
    const g = graph_from_graphml_doc(doc({ nodes: ['a', 'b'], edges: [['a', 'a'], ['a', 'b']] }));
    assert.deepEqual(wire(g), ['0-1']);
    assert.ok(warned(g, /self-loop/));
});

test('duplicate edges are dropped in either direction', () => {
    const g = graph_from_graphml_doc(doc({
        nodes: ['a', 'b'], edges: [['a', 'b'], ['b', 'a'], ['a', 'b']]
    }));
    assert.equal(g.edges.length, 1);
    assert.ok(warned(g, /duplicate/));
});

test('edge missing an endpoint is skipped, not fatal', () => {
    const g = graph_from_graphml_doc(doc({ nodes: ['a', 'b'], edges: [[undefined, 'b'], ['a', 'b']] }));
    assert.equal(g.edges.length, 1);
    assert.ok(warned(g, /missing source or target/));
});

test('node without an id is skipped, not fatal', () => {
    const g = graph_from_graphml_doc(doc({ nodes: ['a', null, 'b'], edges: [] }));
    assert.deepEqual(labels(g), ['a', 'b']);
    assert.ok(warned(g, /without an id/));
});

test('a clean file produces no warnings', () => {
    const g = graph_from_graphml_doc(doc({ nodes: ['a', 'b', 'c'], edges: [['a', 'b'], ['b', 'c']] }));
    assert.deepEqual(g.warnings, []);
});

// ------------------------------------------------------------ flagged input

test('directed input is read as undirected and flagged', () => {
    const g = graph_from_graphml_doc(doc({
        nodes: ['a', 'b'], edges: [['a', 'b']], edgedefault: 'directed'
    }));
    assert.ok(warned(g, /undirected/));
});

test('extra graphs and hyperedges are flagged', () => {
    const g = graph_from_graphml_doc(doc({
        nodes: ['a', 'b'], edges: [['a', 'b']], graphs: 2, hyper: 1
    }));
    assert.ok(warned(g, /using the first/));
    assert.ok(warned(g, /Hyperedges/));
});

// ---------------------------------------------------------------- rejected

test('XML that is not GraphML is rejected with a usable message', () => {
    assert.throws(() => graph_from_graphml_doc(E('html', {}, [])), /No <graph> element found/);
});

test('a graph with no nodes is rejected', () => {
    assert.throws(() => graph_from_graphml_doc(doc({})), /Graph contains no nodes/);
});
