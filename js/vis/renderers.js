function edge_stroke(d) {
    if (d._curv == null) return 'var(--edge)';
    if (d._curv === 0) return 'rgba(255, 255, 0, 0.4)';
    return d._curv < 0 ? 'var(--hub)' : 'rgba(0,250,0,1)';
}

export class GraphRenderer {
    constructor(svgEl) {
        this.svg = d3.select(svgEl);
        this.width = svgEl.clientWidth;
        this.height = svgEl.clientHeight;
        
        this.g = this.svg.append('g');
        this.linkG = this.g.append('g').attr('class', 'links');
        this.nodeG = this.g.append('g').attr('class', 'nodes');
        
        this.simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d=>d.id).distance(50).strength(0.4))
            .force('charge', d3.forceManyBody().strength(-120))
            .force('center', d3.forceCenter(this.width/2, this.height/2))
            .force('collision', d3.forceCollide(18))
            .alphaDecay(0.02)
            .on('tick', () => this._tick());

        this.svg.call(d3.zoom().scaleExtent([0.2,4]).on('zoom', e => {
            this.g.attr('transform', e.transform);
        }));

        this.nodes = [];
        this.links = [];
    }

    update(snapshot) {
        this.nodes = snapshot.nodes.map(d => ({ ...d }));
        this.links = snapshot.edges.map(d => ({ ...d }));
        const hub_id = this._hub_id(this.nodes);

        const deg = {}; // for sizing
        this.links.forEach(l => {
            deg[l.source.id ?? l.source] = (deg[l.source.id ?? l.source]||0)+1;
            deg[l.target.id ?? l.target] = (deg[l.target.id ?? l.target]||0)+1;
        });
        this.nodes.forEach(n => n._deg = deg[n.id] || 0);

        const link = this.linkG.selectAll('line').data(this.links, d=>`${d.source}-${d.target}`);
        link.enter().append('line')
            .attr('class','link')
            .style('opacity',0)
            .style('stroke', edge_stroke)
            .on('mouseover', (event, d) => this._showTooltip_edge(event, d))
            .on('mouseout', () => this._hideTooltip())
            .transition().duration(300).style('opacity',1);
        link.style('stroke', edge_stroke); // curvature only lands on the last step
        link.exit().remove();

        const style_node = sel => sel
            .style('fill',         d => d.id === hub_id ? 'var(--hub)' : 'var(--node)')
            .style('stroke',       d => d.id === hub_id ? 'rgba(255,77,109,0.3)' : 'rgba(0,229,255,0.25)')
            .style('stroke-width', d => d.id === hub_id ? 3 : 1.5)
            .style('filter',       d => d.id === hub_id ? 'drop-shadow(0 0 6px var(--hub))' : 'drop-shadow(0 0 4px var(--node))');

        const node = this.nodeG.selectAll('g.node').data(this.nodes, d=>d.id);
        const nodeEnter = node.enter().append('g').attr('class','node')
            .call(d3.drag()
                .on('start', (event,d) => { if(!event.active) this.simulation.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
                .on('drag',  (event,d) => { d.fx=event.x; d.fy=event.y; })
                .on('end',   (event,d) => { if(!event.active) this.simulation.alphaTarget(0); d.fx=null; d.fy=null; })
            );
        
        style_node(nodeEnter.append('circle').attr('r', 0))
            .transition().duration(400).ease(d3.easeElastic)
            .attr('r', d => Math.max(4, Math.min(14, 4 + d._deg * 1.5)));

        nodeEnter.on('mouseover', (event, d) => this._showTooltip_node(event, d))
            .on('mouseout', () => this._hideTooltip());

        style_node(node.select('circle'))
            .transition().duration(200)
            .attr('r', d => Math.max(4, Math.min(14, 4 + d._deg * 1.5)));
        node.exit().remove();

        this.simulation.nodes(this.nodes);
        this.simulation.force('link').links(this.links);
        this.simulation.alpha(0.4).restart();
    }

    restyle_links() {
        this.linkG.selectAll('line')
            .transition().duration(300)
            .style('opacity', 1)
            .style('stroke', edge_stroke);
    }

    _hub_id(nodes) {
        let best = null, bestVal = 0; // a score must beat 0 to win the highlight
        for (const n of nodes) {
            if (typeof n._closeness !== 'number' || !(n._closeness > bestVal)) continue;
            best = n.id; bestVal = n._closeness;
        }
        return best;
    }

    _tick() {
        this.linkG.selectAll('line')
            .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        this.nodeG.selectAll('g.node')
            .attr('transform', d => `translate(${d.x},${d.y})`);
    }

    _showTooltip_node(event, d) {
        const clos = typeof d._closeness === 'number' ? d._closeness.toFixed(4) : 'Calculating...';
        const tt = document.getElementById('tooltip');
        tt.innerHTML = `node ${d.id} &nbsp;·&nbsp; degree <span style="color:var(--accent)">${d._deg}</span> &nbsp;·&nbsp; closeness <span style="color:var(--accent)">${clos}</span>`;
        tt.style.left = (event.offsetX + 12) + 'px';
        tt.style.top  = (event.offsetY - 28) + 'px';
        tt.style.opacity = 1;
    }
    _showTooltip_edge(event, d){
        const curv = d._curv != null ? d._curv.toFixed(4) : 'N/A';
        const src = d.source.id ?? d.source;
        const tgt = d.target.id ?? d.target;
        const tt = document.getElementById('tooltip');
        tt.innerHTML = `edge ${src} → ${tgt} &nbsp;·&nbsp; curvature <span style="color:var(--accent)">${curv}</span>`;
        tt.style.left = (event.offsetX + 12) + 'px';
        tt.style.top  = (event.offsetY - 28) + 'px';
        tt.style.opacity = 1;
    }
    _hideTooltip() { document.getElementById('tooltip').style.opacity = 0; }

    clear() {
        this.nodes = []; this.links = [];
        this.linkG.selectAll('*').remove();
        this.nodeG.selectAll('*').remove();
        this.simulation.stop();
    }

    resize(w, h) {
        this.width = w; this.height = h;
        this.simulation.force('center', d3.forceCenter(w/2, h/2));
    }

    freeze() {
        this.simulation.stop();
        this.nodes.forEach(n => { n.fx = n.x; n.fy = n.y; });
        this.nodeG.selectAll('g.node').on('.drag', null);
    }
 
    unfreeze() {
        this.nodes.forEach(n => { n.fx = null; n.fy = null; });
 
        this.nodeG.selectAll('g.node')
            .call(d3.drag()
                .on('start', (event, d) => {
                    if (!event.active) this.simulation.alphaTarget(0.3).restart();
                    d.fx = d.x; d.fy = d.y;
                })
                .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
                .on('end',  (event, d) => {
                    if (!event.active) this.simulation.alphaTarget(0);
                    d.fx = null; d.fy = null;
                })
            );
 
        this.simulation.alpha(0.1).restart();
    }
}


import { FiltrationChart } from './charts.js';
import { unionFind, floydWarshall } from '../back_utils.js';
export class CliqueFiltrationRenderer {
    constructor(graphRenderer, chartSvg) {
        this.gr = graphRenderer;
        this.svg = graphRenderer.svg;
        this.g = graphRenderer.g;
        this.timer = null;
        this.morphTimer = null;
        this.running = false;
        this.stepIdx = 0;
        this.steps = [];
        this.maxR = 0;

        this.ballG = this.g.insert('g', '.links').attr('class', 'filtration-balls');
        this.chart = new FiltrationChart(chartSvg)
    }

    start(speedMs = 60, morphMs = 600) {
        if (this.running || this.morphTimer) return;
 
        const nodes = this.gr.nodes;
        const links = this.gr.links;
        if (!nodes.length) return;
 
        this._repositioning(
            nodes, links,
            this.gr.width, this.gr.height,
            { iterations: 80, scale: 280, minDist: 30, padding: 60 }
        );

        this.gr.freeze();

        this.gr.nodeG.selectAll('g.node')
            .transition().duration(morphMs).ease(d3.easeCubicInOut)
            .attr('transform', d => `translate(${d.x},${d.y})`);
 
        this.gr.linkG.selectAll('line')
            .transition().duration(morphMs).ease(d3.easeCubicInOut)
            .attr('x1', d => (typeof d.source === 'object' ? d.source : { x: d.source }).x ?? d.source.x)
            .attr('y1', d => (typeof d.source === 'object' ? d.source : { x: d.source }).y ?? d.source.y)
            .attr('x2', d => (typeof d.target === 'object' ? d.target : { x: d.target }).x ?? d.target.x)
            .attr('y2', d => (typeof d.target === 'object' ? d.target : { x: d.target }).y ?? d.target.y);
 
        this.morphTimer = setTimeout(() => {
            this.morphTimer = null;
            this._beginFiltration(speedMs);
        }, morphMs + 80);
    }
 
    stop() {
        // morphTimer covers the ~680ms morph window, before the first tick exists
        if (this.timer) clearTimeout(this.timer);
        if (this.morphTimer) clearTimeout(this.morphTimer);
        this.timer = null;
        this.morphTimer = null;
        this.running = false;
    }
 
    clear() {
        this.stop();
 
        this.ballG.selectAll('*').remove();
 
        this.gr.restyle_links();
 
        this.gr.unfreeze();
 
        this.chart.clear();
    }
 
    _scheduleTick(speedMs) {
        if (!this.running) return;
        if (this.stepIdx >= this.steps.length - 1) {
            this.running = false;
            if (this.onDone) this.onDone();
            return;
        }
        this.timer = setTimeout(() => {
            this.stepIdx++;
            const step = this.steps[this.stepIdx];
            this._drawBalls(step.r, step.activeEdges);
            this.chart.update(step.r, step.cc);
            this._scheduleTick(speedMs);
        }, speedMs);
    }
 
    _drawBalls(r, activeEdgeSet) {
        const nodes = this.gr.nodes;
 
        this.gr.linkG.selectAll('line')
            .transition().duration(60).ease(d3.easeLinear)
            .style('opacity', d => {
                const s = d.source.id ?? d.source;
                const t = d.target.id ?? d.target;
                return (activeEdgeSet.has(`${s}-${t}`) || activeEdgeSet.has(`${t}-${s}`))
                    ? 0.9 : 0.1;
            })
            .style('stroke', d => {
                const s = d.source.id ?? d.source;
                const t = d.target.id ?? d.target;
                return (activeEdgeSet.has(`${s}-${t}`) || activeEdgeSet.has(`${t}-${s}`))
                    ? 'var(--accent)' : 'rgba(0,229,255,0.18)';
            });
 
        const balls = this.ballG.selectAll('circle.fball')
            .data(nodes, d => d.id);
 
        balls.enter().append('circle')
            .attr('class', 'fball')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', 0)
            .style('fill', 'var(--accent)')
            .style('fill-opacity', 0.06)
            .style('stroke', 'var(--accent)')
            .style('stroke-opacity', 0.25)
            .style('stroke-width', 1)
            .style('pointer-events', 'none');
 
        this.ballG.selectAll('circle.fball')
            .transition().duration(60).ease(d3.easeLinear)
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', r);
    }

    _beginFiltration(speedMs) {
        const nodes = this.gr.nodes;
        const links = this.gr.links;
 
        const nodeById = {};
        nodes.forEach(n => nodeById[n.id] = n);
 
        const weightedEdges = links.map(l => {
            const s = typeof l.source === 'object' ? l.source : nodeById[l.source];
            const t = typeof l.target === 'object' ? l.target : nodeById[l.target];
            if (!s || !t) return null;
            const dx = s.x - t.x, dy = s.y - t.y;
            return { s, t, w: Math.sqrt(dx * dx + dy * dy) };
        }).filter(Boolean);
 
        const thresholds = [...new Set(weightedEdges.map(e => e.w / 2))]
            .sort((a, b) => a - b);
        this.maxR = thresholds.length ? thresholds[thresholds.length - 1] : 1;
 
        const allR = [0, ...thresholds];
        this.steps = allR.map(r => ({
            r,
            cc: this._countCC(nodes, weightedEdges, r),
            activeEdges: new Set(weightedEdges.filter(e => e.w / 2 <= r).map(e => `${e.s.id}-${e.t.id}`))
        }));
 
        this.stepIdx = 0;
        this.running = true;
 
        this.gr.linkG.selectAll('line')
            .transition().duration(300)
            .style('opacity', 0.1)
            .style('stroke', 'rgba(0,229,255,0.18)');
 
        this.chart.init(this.steps, nodes.length);
        this._drawBalls(0, new Set());
        this.chart.update(0, this.steps[0].cc);
        this._scheduleTick(speedMs);
    }


    _repositioning(nodes, links, canvasW, canvasH, opts = {}){
        const {
            iterations = 80,
            scale = 300,
            minDist = 30,
            padding = 60
        } = opts;

        if (!nodes.length || !links.length){
            return;
        }

        const nodeById = {};
        nodes.forEach(n => nodeById[n.id] = n);
    
        const edges = links.map(l => {
            const s = typeof l.source === 'object' ? l.source : nodeById[l.source];
            const t = typeof l.target === 'object' ? l.target : nodeById[l.target];
            if (!s || !t) return null;
            return { s, t, curv: l._curv ?? 0 };
        }).filter(Boolean);

        if (!edges.length){
            return;
        }

        const curvVals = edges.map(e => e.curv);
        const curvMin = Math.min(...curvVals);
        const curvMax = Math.max(...curvVals);
        const curvRange = curvMax - curvMin || 1;

        edges.forEach(e => {
            const curvNorm = (e.curv - curvMin) / curvRange; // 0 = most negative, 1 = most positive
            e.targetDist = (1 - curvNorm) * scale + minDist; // high curv => short, low curv => long
        });

        const dists = floydWarshall(nodes, edges);
        const adj = {};
        nodes.forEach(n => adj[n.id] = []);
        for(const [k, v] of Object.entries(dists)){
            for(const [k2, v2] of Object.entries(v)){
                if(k !== k2){
                    adj[k].push({nb: nodes[k2], targetDist: v2, weight: 1/(v2*v2)})
                }
            }
        }

        for(let i=0; i< iterations; i++){
            const order = nodes.slice().sort(() => Math.random() - 0.5); //shuffle
            for(const node of order){
                const neis = adj[node.id];
                if (!neis.length) {
                    continue;
                }

                let sumW = 0, sumX = 0, sumY = 0;
                for( const {nb, targetDist, weight} of neis){
                    const dx = node.x - nb.x;
                    const dy = node.y - nb.y;
                    const dist = Math.sqrt(dx*dx + dy*dy)

                    sumW += weight;
                    if(dist < 1e-6){
                        sumX += weight * (nb.x + targetDist);
                        sumY += weight * (nb.y + targetDist);
                    } else {
                        sumX += weight * (nb.x + targetDist * dx / dist);
                        sumY += weight * (nb.y + targetDist * dy / dist);
                    }
                }
                node.x = sumX / sumW;
                node.y = sumY / sumW;
            }
        }

        this._fitToCanvas(nodes, canvasW, canvasH, padding);
    }

    _fitToCanvas(nodes, W, H, padding) {
        const xs = nodes.map(n => n.x);
        const ys = nodes.map(n => n.y);
        const xMin = Math.min(...xs), xMax = Math.max(...xs);
        const yMin = Math.min(...ys), yMax = Math.max(...ys);
    
        const xRange = xMax - xMin || 1;
        const yRange = yMax - yMin || 1;
    
        const availW = W - 2 * padding;
        const availH = H - 2 * padding;
    
        const s = Math.min(availW / xRange, availH / yRange);
    
        const offsetX = (W - s * xRange) / 2 - s * xMin;
        const offsetY = (H - s * yRange) / 2 - s * yMin;
    
        nodes.forEach(n => {
            n.x = s * n.x + offsetX;
            n.y = s * n.y + offsetY;
            if (n.fx != null) n.fx = n.x;
            if (n.fy != null) n.fy = n.y;
        });
    }
 
    _countCC(nodes, edges, r) {
        return unionFind(nodes, edges, r);
    }
}
