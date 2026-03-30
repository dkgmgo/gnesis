export class DegreeChart {
    constructor(svgEl) {
        this.svgEl = svgEl;
        this.margin = { top: 4, right: 6, bottom: 18, left: 24 };
    }
 
    update(snap) {
        const el = this.svgEl;
        const W = el.parentElement.clientWidth - 24;
        const H = +el.getAttribute('height');
        const { top, right, bottom, left } = this.margin;
        const w = W - left - right;
        const h = H - top - bottom;

        // Compute degree counts
        const deg = {};
        snap.edges.forEach(ed => {
            const s = ed.source?.id ?? ed.source, t = ed.target?.id ?? ed.target;
            deg[s] = (deg[s]||0)+1; deg[t] = (deg[t]||0)+1;
        });
        snap.nodes.forEach(n => { if (deg[n.id] === undefined) deg[n.id] = 0; });

        const counts = {};
        Object.values(deg).forEach(d => { counts[d] = (counts[d]||0)+1; });

        const maxDeg = Object.keys(counts).length ? Math.max(...Object.keys(counts).map(Number)) : 0;
        const data = Array.from({length: maxDeg + 1}, (_, k) => ({ k, count: counts[k] || 0 }));

        const xScale = d3.scaleBand()
            .domain(data.map(d => d.k))
            .range([0, w])
            .padding(0.18);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.count) || 1])
            .range([h, 0])
            .nice();

        // Clear & rebuild
        const svg = d3.select(el);
        svg.selectAll('*').remove();
        svg.attr('width', W);

        const g = svg.append('g').attr('transform', `translate(${left},${top})`);

        // Grid lines
        g.append('g').attr('class','grid')
            .selectAll('line')
            .data(yScale.ticks(3))
            .enter().append('line')
            .attr('x1', 0).attr('x2', w)
            .attr('y1', d => yScale(d)).attr('y2', d => yScale(d))
            .attr('stroke', 'rgba(30,42,56,0.7)').attr('stroke-dasharray', '3,3');

        // Bars
        g.selectAll('.deg-bar')
            .data(data)
            .enter().append('rect')
            .attr('class', d => 'deg-bar')
            .attr('x', d => xScale(d.k))
            .attr('width', xScale.bandwidth())
            .attr('y', d => yScale(d.count))
            .attr('height', d => h - yScale(d.count))
            .attr('rx', 2);

        // X axis show only every few ticks if crowded
        const tickEvery = maxDeg > 20 ? Math.ceil(maxDeg / 10) : 1;
        const xAxis = d3.axisBottom(xScale)
            .tickValues(data.filter(d => d.k % tickEvery === 0).map(d => d.k))
            .tickSize(3);

        g.append('g').attr('class','deg-axis')
            .attr('transform', `translate(0,${h})`)
            .call(xAxis)
            .select('.domain').remove();

        // Y axis
        const yAxis = d3.axisLeft(yScale).ticks(3).tickSize(3);
        g.append('g').attr('class','deg-axis')
            .call(yAxis)
            .select('.domain').remove();
    }

    clear() {
        d3.select(this.svgEl).selectAll('*').remove();
    }
}