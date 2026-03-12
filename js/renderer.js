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
        const max_closeness =  Math.max(...this.nodes.map(n => n._closeness || 0));

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
            .transition().duration(300).style('opacity',1);
        link.exit().remove();

        const node = this.nodeG.selectAll('g.node').data(this.nodes, d=>d.id);
        const nodeEnter = node.enter().append('g').attr('class','node')
            .call(d3.drag()
                .on('start', (event,d) => { if(!event.active) this.simulation.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
                .on('drag',  (event,d) => { d.fx=event.x; d.fy=event.y; })
                .on('end',   (event,d) => { if(!event.active) this.simulation.alphaTarget(0); d.fx=null; d.fy=null; })
            );
        
        nodeEnter.append('circle')
            .attr('r', 0)
            .style('fill', d => d._closeness == max_closeness ? 'var(--hub)' : 'var(--node)')
            .style('stroke', d => d._closeness == max_closeness ? 'rgba(255,77,109,0.3)' : 'rgba(0,229,255,0.25)')
            .style('stroke-width', d => d._closeness == max_closeness ? 3 : 1.5)
            .style('filter', d => d._closeness == max_closeness ? 'drop-shadow(0 0 6px var(--hub))' : 'drop-shadow(0 0 4px var(--node))')
            .transition().duration(400).ease(d3.easeElastic)
            .attr('r', d => Math.max(4, Math.min(14, 4 + d._deg * 1.5)));

        nodeEnter.on('mouseover', (event, d) => this._showTooltip(event, d))
            .on('mouseout', () => this._hideTooltip());

        node.select('circle')
            .style('fill', d => d._closeness == max_closeness ? 'var(--hub)' : 'var(--node)')
            .style('stroke', d => d._closeness == max_closeness ? 'rgba(255,77,109,0.3)' : 'rgba(0,229,255,0.25)')
            .style('stroke-width', d => d._closeness == max_closeness ? 3 : 1.5)
            .style('filter', d => d._closeness == max_closeness ? 'drop-shadow(0 0 6px var(--hub))' : 'drop-shadow(0 0 4px var(--node))')
            .transition().duration(200)
            .attr('r', d => Math.max(4, Math.min(14, 4 + d._deg * 1.5)));
        node.exit().remove();

        this.simulation.nodes(this.nodes);
        this.simulation.force('link').links(this.links);
        this.simulation.alpha(0.4).restart();
    }

    _tick() {
        this.linkG.selectAll('line')
            .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        this.nodeG.selectAll('g.node')
            .attr('transform', d => `translate(${d.x},${d.y})`);
    }

    _showTooltip(event, d) {
        const clos = d._closeness ? d._closeness.toFixed(4) : 'Calculating...';
        const tt = document.getElementById('tooltip');
        tt.innerHTML = `node ${d.id} &nbsp;·&nbsp; degree <span style="color:var(--accent)">${d._deg}</span> &nbsp;·&nbsp; closeness <span style="color:var(--accent)">${clos}</span>`;
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
}