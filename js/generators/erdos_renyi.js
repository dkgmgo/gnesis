import * as utils from '../back_utils.js';

export class ErdosRenyiGenerator{
    constructor(){
        this.label = "Erdős-Rényi";
        this.description = "Graph based on edge probability";
        this.id = "erdos-renyi";
        this.params = [
            {id: "n", label: 'Nodes', min: 1, max: 100, step: 1, default: 30 },
            { id: 'prob', label: 'Edge Prob', min: 0, max: 1, step: 0.01, default: 0.2 },
            { id: 'seed', label: 'Random Seed', min: 0, max: 200, step: 1, default: 42 },
        ];
    }

    build({ n, prob, seed }) {
        const nodes = Array.from({length: n}, (_,i) => ({ id: i, step: i }));
        const edges = [];
        const steps = [];
        const rnd = utils.mulberry32(seed);
        for (let i = 0; i < n; i++) {
            for (let j = i+1; j < n; j++){
                if (rnd() < prob){
                    edges.push({ source: j, target: i, step: i });
                }
            }
            steps.push({ nodes: nodes.map(d=>({...d})), edges: edges.map(d=>({...d})) });
        }
        utils.closeness_centrality(steps[steps.length - 1]);
        utils.ollivier_ricci_curvature(steps[steps.length - 1]);
        return steps;
    }
}
