import * as utils from "../back_utils.js"

export class WattsStrogatzGenerator{
    constructor(){
        this.label = "Watts-Strogatz"
        this.description = "Small world model, ring rewiring"
        this.id = "watts-strogatz"
        this.params = [
            {id: 'n', label: 'Nodes', min: 6, max: 100, step: 2, default: 30},
            {id: 'k', label: 'Neighbors', min: 2, max: 10, step: 2, default: 4},
            { id: 'prob', label: 'Rewire Prob', min: 0, max: 1, step: 0.01, default: 0.2 },
            { id: 'seed', label: 'Random Seed', min: 0, max: 200, step: 1, default: 42 },
        ]
    }

    check_params({n, k, prob, seed}){
        if(n%2 != 0){
            return "Error: Number of nodes should be even"
        }
    }

    build({n, k, prob, seed}){
        const nodes = Array.from({length: n}, (_,i) => ({ id: i, step: 0 }));
        const edgeSet = new Set();
        const edges = [];

        //ring lattice
        for(let i=0; i<n; i++){
            for(let j=1; j<=k/2; j++){
                const t = (i+j) % n
                const key = Math.min(i, t)+','+Math.max(i, t)
                if(!edgeSet.has(key)){
                    edgeSet.add(key);
                    edges.push({source: i, target: t, step: 0})
                }
            }
        }
        const steps = [{ nodes: nodes.map(d=>({...d})), edges: edges.map(d=>({...d})) }];
        const rnd = utils.mulberry32(seed);
        
        //rewiring
        for (let e of edges) {
            if (rnd() < prob) {
            let newT;
            let tries = 0;
            do {
                newT = Math.floor(rnd() * n);
                tries++;
            } while ((newT === e.source || edgeSet.has(Math.min(e.source,newT)+','+Math.max(e.source,newT))) && tries < 100);
            if (tries < 100) {
                edgeSet.delete(Math.min(e.source,e.target)+','+Math.max(e.source,e.target));
                e.target = newT;
                edgeSet.add(Math.min(e.source,newT)+','+Math.max(e.source,newT));
            }
            }
            steps.push({ nodes: nodes.map(d=>({...d})), edges: edges.map(d=>({...d})) });
        }
        utils.closeness_centrality(steps[steps.length - 1]);
        return steps;
    }
}
