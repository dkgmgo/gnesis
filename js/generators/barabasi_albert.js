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
            { id: 'seed', label: 'Random Seed', min: 0, max: 200, step: 1, default: 50 },
        ];
        this._degrees = {};
        this._rng = null;
        this._repeated_nodes = [];
    }

    check_params({ m0, m, t, seed }) {
        if (m > m0) {
            return "Error: Number of edges per new node cannot be greater than initial number of nodes.";
        }
        return null;
    }

    build({ m0, m, t, seed }) {
        this._degrees = {};
        this._rng = utils.mulberry32(seed);
        this._repeated_nodes = [];
        const nodes = [], edges = [], steps = []; 

        for (let i = 0; i < m0; i++) {
            nodes.push({ id: i, step: 0 });
            for (let j = i+1; j < m0; j++) {
                edges.push({ source: i, target: j, step: 0 });
                this._degrees[i] = (this._degrees[i] || 0) + 1;
                this._degrees[j] = (this._degrees[j] || 0) + 1;
                this._repeated_nodes.push(i)
                this._repeated_nodes.push(j)
            }
        }
        steps.push({ nodes: nodes.map(d=>({...d})), edges: edges.map(d=>({...d})) });

        for (let i = m0; i < m0 + t; i++) {
            nodes.push({ id: i, step: i - m0 + 1 });
            this._degrees[i] = 0;
            const targets = this._preferential_attachment(m);
            targets.forEach(tgt => {
                edges.push({ source: i, target: tgt, step: i - m0 + 1 });
                this._degrees[i] += 1;
                this._degrees[tgt] += 1;
                this._repeated_nodes.push(i)
                this._repeated_nodes.push(tgt)
            });
            steps.push({ nodes: nodes.map(d=>({...d})), edges: edges.map(d=>({...d})) });
        }
        utils.closeness_centrality(steps[steps.length - 1]);
        utils.ollivier_ricci_curvature(steps[steps.length - 1]);
        return steps;
    }

    _preferential_attachment(m) {
        let targets = new Set();

        while (targets.size < m) {
            const idx = Math.floor(this._rng() * this._repeated_nodes.length);
            const tgt = this._repeated_nodes[idx];
            targets.add(tgt);
        }
        return Array.from(targets);
    }
}