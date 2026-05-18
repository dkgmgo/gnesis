import * as utils from '../back_utils.js'

export class SBMGenerator{
    constructor(){
        this.label = 'Stochastic Block Model';
        this.description = 'Graphs containing communities (actually this is a planted partition model)'
        this.id = 'sbm';
        this.params = [
            {id: "n", label: 'Nodes', min: 1, max: 100, step: 1, default: 30},
            {id: "k", label: 'Blocks (communities)', min: 1, max: 10, step: 1, default: 3},
            {id: "p", label: 'Intra-block Probability', min: 0, max: 1, step: 0.01, default: 0.7},
            {id: "q", label: 'Inter-block Probability', min: 0, max: 1, step: 0.01, default: 0.05},
            {id: 'seed', label: 'Random Seed', min: 0, max: 200, step: 1, default: 42}
        ];
    }

    check_params({n, k, p, q, seed}){
        if(k > n){
            return "Error: k cannot exceed n; each block needs at least one node";
        }
        return null;
    }

    build({n, k, p, q, seed}){
        const rnd = utils.mulberry32(seed);
        const nodes = [], edges = [], steps = [];

        for (let i=0; i<n; i++){
            nodes.push({
                id: i,
                block: i%k
            });
        }
        steps.push({ nodes: nodes.map(d=>({...d})), edges: edges.map(d=>({...d})) });

        for (let i=0; i<n; i++){
            for (let j=i+1; j<n; j++){
                const prob = nodes[i].block === nodes[j].block ? p : q;
                if(rnd() < prob){
                    edges.push({source: i, target: j});
                }
            }
            steps.push({ nodes: nodes.map(d=>({...d})), edges: edges.map(d=>({...d})) });
        }
        utils.closeness_centrality(steps[steps.length - 1]);
        utils.ollivier_ricci_curvature(steps[steps.length - 1]);
        return steps;
    }
}