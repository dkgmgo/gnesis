import { mulberry32 } from '../back_utils.js';

export class RGGGenerator {
    constructor(){
        this.label = "Random Geometric Graph";
        this.description = "Randomly placing nodes in some metric space";
        this.id = "random-geometric";
        this.params = [
            {id: "n", label: 'Nodes', min: 1, max: 100, step: 1, default: 30 },
            {id: "r", label: 'Connection Radius', min: 0.01, max: 1, step: 0.01, default: 0.25},
            {id: 'seed', label: 'Random Seed', min: 0, max: 200, step: 1, default: 42 },
        ]
    }

    build({n, r, seed}){
        const rnd = mulberry32(seed);
        const nodes = [], edges = [], steps = [];

        for (let i=0; i<n; i++){
            nodes.push({
                id: i,
                x: rnd(),
                y: rnd()
            });
        }
        steps.push({ nodes: nodes.map(d=>({...d})), edges: edges.map(d=>({...d})) });

        for(let i=0; i<n; i++){
            for(let j=i+1; j<n; j++){
                if (this._euclidean_distance(nodes[i], nodes[j]) <= r){
                    edges.push({source: i, target: j});
                }
            }
            steps.push({ nodes: nodes.map(d=>({...d})), edges: edges.map(d=>({...d})) });
        }
        return steps;
    }

    _euclidean_distance(p, q){
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        return Math.sqrt(dx*dx + dy*dy);
    }
}