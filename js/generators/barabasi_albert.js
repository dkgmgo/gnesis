import * as utils from '../back_utils.js';

export class BarabasiAlbertGenerator {
    constructor(){
        this.label = 'Barabási-Albert Model';
        this.description = 'A scale-free network model based on preferential attachment';
        this.id = 'barabasi-albert';
        this.params = [
            { id: 'm0', label: 'Initial Number of Nodes', min: 1, max: 10, step: 1, default: 2 },
            { id: 'm', label: 'Edges per new Node', min: 1, max: 10, step: 1, default: 1 },
            { id: 't', label: 'Number of Time Steps', min: 1, max: 100, step: 1, default: 20 },
            { id: 'seed', label: 'Random Seed', min: 0, max: 200, step: 1, default: 42 },
        ];
        this._degrees = {};
    }

    check_params({ m0, m, t, seed }) {
        if (m > m0) {
            return "Error: Number of edges per new node cannot be greater than initial number of nodes.";
        }
        return null;
    }

    build({ m0, m, t, seed }) {
        this._degrees = {};
        const nodes = [], edges = [], steps = [];

        for (let i = 0; i < m0; i++) {
            nodes.push({ id: i, step: 0 });
            for (let j = i+1; j < m0; j++) {
                edges.push({ source: i, target: j, step: 0 });
                this._degrees[i] = (this._degrees[i] || 0) + 1;
                this._degrees[j] = (this._degrees[j] || 0) + 1;
            }
        }
        steps.push({ nodes: nodes.map(d=>({...d})), edges: edges.map(d=>({...d})) });

        for (let i = m0; i < m0 + t; i++) {
            nodes.push({ id: i, step: i - m0 + 1 });
            const targets = this._preferential_attachment(nodes, m, seed);
            targets.forEach(tgt => {
                edges.push({ source: i, target: tgt, step: i - m0 + 1 });
                this._degrees[i] = (this._degrees[i] || 0) + 1;
                this._degrees[tgt] += 1;
            });
            steps.push({ nodes: nodes.map(d=>({...d})), edges: edges.map(d=>({...d})) });
        }
        utils.closeness_centrality(steps[steps.length - 1]);
        return steps;
    }

    _preferential_attachment(nodes, m, seed) {
        let targets = new Set();
        let avail = nodes.map(n => n.id).filter(id => id !== nodes.length - 1); // exclude the new node itself
        while (targets.size < m) {
            const degs = avail.map(id => this._degrees[id] || 0);
            const totalDeg = degs.reduce((a,b) => a+b, 0) || 1;
            const weights = degs.map(d => d / totalDeg);
            const tgt = this._weighted_random_choice(avail, weights, seed);
            targets.add(tgt);
            avail = avail.filter(id => id !== tgt);
        }
        return Array.from(targets);
    }

    _weighted_random_choice(items, weights, seed) {
        const rnd = this._mulberry32(seed)();
        let cumulative = 0;
        for (let i = 0; i < items.length; i++) {
            cumulative += weights[i];
            if (rnd < cumulative){
                return items[i];
            }
        }
        return items[items.length - 1];
    }

    _mulberry32(seed) {
        return function() {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0;
            var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }
}