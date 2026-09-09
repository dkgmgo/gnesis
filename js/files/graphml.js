// GraphML import

const tags = (root, name) => Array.from(root.getElementsByTagNameNS('*', name));

// direct children only: a <node> may hold a nested <graph> with data of its own
const own = (el, name) => Array.from(el.children ?? []).filter(c => c.localName === name);

const text_of = el => (el.textContent ?? '').trim();

// <key> declares an attribute, <data key=".."> carries it. Names are matched
// case-insensitively ("Name" vs "name") and several keys may share one name.
function key_table(doc) {
    const by_id = new Map();
    const by_name = { node: new Map(), edge: new Map() };
    for (const el of tags(doc, 'key')) {
        const id = el.getAttribute('id');
        const name = el.getAttribute('attr.name');
        if (id == null || name == null) continue;
        const fallback = own(el, 'default')[0];
        by_id.set(id, { name, def: fallback ? text_of(fallback) : null });
        const domain = el.getAttribute('for');
        for (const d of (domain === 'node' || domain === 'edge') ? [domain] : ['node', 'edge']) {
            const k = name.toLowerCase();
            if (!by_name[d].has(k)) by_name[d].set(k, []);
            by_name[d].get(k).push(id);
        }
    }
    return { by_id, by_name };
}

function data_values(el) {
    const values = new Map();
    for (const d of own(el, 'data')) {
        const k = d.getAttribute('key');
        if (k == null) continue;
        const v = text_of(d);
        if (v !== '' && (values.get(k) ?? '') === '') values.set(k, v);
        else if (!values.has(k)) values.set(k, v);
    }
    return values;
}

// first non-empty wins, across repeated <data> and across keys sharing a name
function attr_value(keys, domain, values, names) {
    for (const name of names) {
        for (const id of keys.by_name[domain].get(name.toLowerCase()) ?? []) {
            const raw = values.has(id) && values.get(id) !== ''
                ? values.get(id) : keys.by_id.get(id)?.def;
            if (raw != null && raw !== '') return raw;
        }
    }
    return null;
}

function number_attr(keys, domain, values, names) {
    const raw = attr_value(keys, domain, values, names);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

export function parse_graphml(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    // DOMParser signals failure by returning an error document, not by throwing.
    // The element is namespaced differently per browser, hence the wildcard.
    const err = tags(doc, 'parsererror')[0];
    if (err) {
        const first = err.textContent.trim().split('\n')[0];
        throw new Error(`File is not valid XML: ${first}`);
    }
    return graph_from_graphml_doc(doc);
}

// Returns { nodes, edges, warnings, read }; read counts attributes taken from <data>
export function graph_from_graphml_doc(doc) {
    const warnings = [];

    const graphs = tags(doc, 'graph');
    if (!graphs.length) throw new Error('No <graph> element found.');
    if (graphs.length > 1) warnings.push(`${graphs.length} graphs in file; using the first.`);
    const graph = graphs[0];
    const keys = key_table(doc);
    const read = { labels: 0, curv: 0, distance: 0 };

    if (tags(graph, 'hyperedge').length) {
        warnings.push('Hyperedges are not supported and were skipped.');
    }
    if (graph.getAttribute('edgedefault') === 'directed') {
        warnings.push('Directed graph read as undirected.');
    }

    // The original node name is kept as `label` for tooltips.
    const index = new Map();
    const nodes = [];
    const intern = raw => {
        if (!index.has(raw)) {
            index.set(raw, nodes.length);
            nodes.push({ id: nodes.length, gid: raw, label: raw });
        }
        return index.get(raw);
    };

    for (const el of tags(graph, 'node')) {
        const id = el.getAttribute('id');
        if (id == null) { warnings.push('Node without an id; skipped.'); continue; }
        const node = nodes[intern(id)];
        const name = attr_value(keys, 'node', data_values(el), ['name', 'label']);
        if (name != null) { node.label = name; read.labels++; }
    }
    const declared = nodes.length;

    const seen = new Set();
    const edges = [];
    let loops = 0, dupes = 0;
    for (const el of tags(graph, 'edge')) {
        const s = el.getAttribute('source'), t = el.getAttribute('target');
        if (s == null || t == null) { warnings.push('Edge missing source or target; skipped.'); continue; }
        const u = intern(s), v = intern(t);
        if (u === v) { loops++; continue; }
        const key = Math.min(u, v) + ',' + Math.max(u, v);
        if (seen.has(key)) { dupes++; continue; }
        seen.add(key);

        const edge = { source: u, target: v };
        const values = data_values(el);
        // curvature from the file wins; the metrics panel only offers to compute it where the file has none
        const curv = number_attr(keys, 'edge', values, ['curv']);
        if (curv != null) { edge._curv = curv; read.curv++; }
        const distance = number_attr(keys, 'edge', values, ['distance']);
        if (distance != null) { edge._distance = distance; read.distance++; }
        edges.push(edge);
    }

    if (nodes.length > declared) {
        warnings.push(`${nodes.length - declared} node(s) referenced by an edge but never declared; added.`);
    }
    if (loops) warnings.push(`${loops} self-loop(s) removed.`);
    if (dupes) warnings.push(`${dupes} duplicate edge(s) removed.`);
    if (!nodes.length) throw new Error('Graph contains no nodes.');

    return { nodes, edges, warnings, read };
}
