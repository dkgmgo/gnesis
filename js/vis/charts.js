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


export class FiltrationChart {
    constructor(svgEl) {
        this.svgEl = svgEl;
        this.wrap = document.getElementById('filt-chart-wrap');
        this.margin = { top: 6, right: 8, bottom: 20, left: 28 };
        this.steps = [];
        this.maxCC = 1;
        this.maxR = 1;
        this._dot = null;
        this._label = null;
    }
 
    init(steps, maxCC) {
        this.steps = steps;
        this.maxCC = maxCC || 1;
        this.maxR = steps.length ? steps[steps.length - 1].r : 1;
 
        if (this.wrap) this.wrap.style.display = 'block';
 
        this._buildScales();
        this._buildAxes();
        this._drawGhostCurve();
    }
 
    update(r, cc) {
        if (!this._svg) return;
        this._drawActiveCurve(r, cc);
        this._moveDot(r, cc);
    }
 
    clear() {
        if (this.wrap) this.wrap.style.display = 'none';
        if (this._svg) this._svg.selectAll('*').remove();
        this._svg = null;
        this._dot = null;
        this._label = null;
        this.steps = [];
    }
 
    _buildScales() {
        const el = this.svgEl;
        const W = (el.parentElement.clientWidth || 220) - 24;
        const H = +el.getAttribute('height') || 110;
        const { top, right, bottom, left } = this.margin;
 
        this._W = W;
        this._H = H;
        this._w = W - left - right;
        this._h = H - top - bottom;
 
        this._xScale = d3.scaleLinear().domain([0, this.maxR]).range([0, this._w])
 
        this._yScale = d3.scaleLinear().domain([0, this.maxCC]).range([this._h, 0]);
    }
 
    _buildAxes() {
        const el = this.svgEl;
        const { top, right, bottom, left } = this.margin;
 
        const svg = d3.select(el);
        svg.selectAll('*').remove();
        svg.attr('width', this._W);
        this._svg = svg;
 
        const g = svg.append('g').attr('transform', `translate(${left},${top})`);
        this._g = g;
 
        g.append('g').selectAll('line')
            .data(this._yScale.ticks(3))
            .enter().append('line')
            .attr('x1', 0).attr('x2', this._w)
            .attr('y1', d => this._yScale(d))
            .attr('y2', d => this._yScale(d))
            .attr('stroke', 'rgba(30,42,56,0.7)')
            .attr('stroke-dasharray', '3,3');
 
        const xAxis = d3.axisBottom(this._xScale)
            .ticks(4)
            .tickSize(3)
            .tickFormat(d => d.toFixed(0));
 
        g.append('g').attr('class', 'deg-axis')
            .attr('transform', `translate(0,${this._h})`)
            .call(xAxis)
            .select('.domain').remove();
 
        g.append('text')
            .attr('x', this._w)
            .attr('y', this._h + 16)
            .attr('text-anchor', 'end')
            .attr('fill', 'var(--muted)')
            .attr('font-size', '0.55rem')
            .attr('font-family', 'inherit')
            .text('radius r');
 
        const yAxis = d3.axisLeft(this._yScale)
            .ticks(Math.min(this.maxCC, 4))
            .tickSize(3)
            .tickFormat(d3.format('d'));
 
        g.append('g').attr('class', 'deg-axis')
            .call(yAxis)
            .select('.domain').remove();
 
        svg.append('defs').append('clipPath')
            .attr('id', 'filt-clip')
            .append('rect')
            .attr('x', 0).attr('y', 0)
            .attr('width', this._w).attr('height', this._h);
 
        this._curveG = g.append('g').attr('clip-path', 'url(#filt-clip)');
 
        this._dot = g.append('circle')
            .attr('r', 4)
            .attr('fill', 'var(--accent2)')
            .attr('stroke', 'var(--bg)')
            .attr('stroke-width', 1.5)
            .style('display', 'none');
 
        this._label = g.append('text')
            .attr('font-size', '0.58rem')
            .attr('font-family', 'inherit')
            .attr('fill', 'var(--text)')
            .style('display', 'none');
    }
 
    _drawGhostCurve() {
        if (!this._curveG) return;
        const pts = this._stepPath(this.steps, this.steps.length - 1);
        this._curveG.append('path')
            .attr('d', pts)
            .attr('fill', 'none')
            .attr('stroke', 'grey')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3')
    }
 
    _drawActiveCurve(currentR, currentCC) {
        let upTo = 0;
        for (let i = 0; i < this.steps.length; i++) {
            if (this.steps[i].r <= currentR) {
                upTo = i;
            }
        }
 
        this._curveG.selectAll('path.filt-active').remove();
 
        const pts = this._stepPath(this.steps, upTo);
        this._curveG.append('path')
            .attr('class', 'filt-active')
            .attr('d', pts)
            .attr('fill', 'none')
            .attr('stroke', 'var(--accent)')
            .attr('stroke-width', 2);
    }
 
    _moveDot(r, cc) {
        if (!this._dot || !this._label) return;
        const x = this._xScale(r);
        const y = this._yScale(cc);
 
        this._dot
            .style('display', null)
            .attr('cx', x)
            .attr('cy', y);
 
        const labelX = x + 5 > this._w - 32 ? x - 34 : x + 5;
        this._label
            .style('display', null)
            .attr('x', labelX)
            .attr('y', y - 5)
            .text(`CC=${cc}`);
    }
 
    _stepPath(steps, upTo) {
        if (!steps.length) return '';
        const xs = this._xScale, ys = this._yScale;
        let d = `M ${xs(steps[0].r)} ${ys(steps[0].cc)}`;
        for (let i = 0; i < upTo; i++) {
            const x1 = xs(steps[i + 1].r);
            const y0 = ys(steps[i].cc);
            const y1 = ys(steps[i + 1].cc);
            d += ` H ${x1} V ${y1}`;
        }
        return d;
    }
}
