import * as utils from '../back_utils.js';

export class GridGenerator {
    constructor(){
        this.label = '2D Grid';
        this.description = 'A regular 2D grid';
        this.id = '2d-grid';
        this.params = [
            { id: 'rows', label: 'Rows',    min: 2, max: 12, step: 1, default: 5 },
            { id: 'cols', label: 'Columns', min: 2, max: 12, step: 1, default: 5 },
        ];
    }
    
    build({ rows, cols }) {
      const nodes = [], edges = [], steps = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const id = r * cols + c;
          nodes.push({ id, step: id, row: r, col: c });
          if (c > 0) edges.push({ source: id - 1, target: id, step: id });
          if (r > 0) edges.push({ source: id - cols, target: id, step: id });
          steps.push({ nodes: nodes.map(d=>({...d})), edges: edges.map(d=>({...d})) });
        }
      }
      utils.closeness_centrality(steps[steps.length - 1]);
      return steps;
    }
}