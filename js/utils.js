import { GridGenerator } from "./generators/grid.js";

const grid_gen = new GridGenerator();

export function list_generators() {
    return {
        '2d-grid': grid_gen,
    }
}

export function build_generators_panel(gens, currentGen) {
    const panel = document.getElementById('generators-list');
    Object.values(gens).forEach(gen => {
        const div = document.createElement('div');
        div.innerHTML = `<button class="gen-btn ${gen.id === currentGen ? 'active' : ''}" data-gen="${gen.id}">
            <span class="gen-name">${gen.label}</span>
            <span class="gen-desc">${gen.description}</span>
            </button>`;
        panel.appendChild(div);
    });
}

export function get_speed() {
    const v = +document.getElementById('speed-range').value;
    return Math.round(1000 / (v * v * 0.01 + 2));
}

export function build_params_panel(gen) {
    const panel = document.getElementById('params-panel');
    gen.params.forEach(p => {
        const row = document.createElement('div'); 
        row.className = 'param-row';
        row.innerHTML = `<label>${p.label} <span class="val" id="pv-${p.id}">${p.default}</span></label>
            <input type="range" id="p-${p.id}" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.default}">`;
        panel.appendChild(row);
        setTimeout(() => {
            const inp = document.getElementById(`p-${p.id}`);
            inp.addEventListener('input', () => {
                document.getElementById(`pv-${p.id}`).textContent = inp.value;
            });
        }, 0);
    });
}

export function get_params(params) {
    const out = {};
    params.forEach(p => {
        const el = document.getElementById(`p-${p.id}`);
        out[p.id] = el ? +el.value : p.default;
    });
    return out;
}

export function set_status(msg, active=false) {
    document.getElementById('status-msg').textContent = msg;
    document.getElementById('status-dot').className = 'dot' + (active ? '' : ' idle');
}

export function update_properties(snap) {
    const n = snap.nodes.length, m = snap.edges.length;
    const deg = {};
    snap.edges.forEach(ed => {
        const s = ed.source?.id ?? ed.source, t = ed.target?.id ?? ed.target;
        deg[s] = (deg[s]||0)+1; deg[t] = (deg[t]||0)+1;
    });
    const degs = Object.values(deg);
    const maxD = degs.length ? Math.max(...degs) : 0;
    const avgD = n > 1 ? (2*m/n) : 0;
    const dens = n > 1 ? (2*m / (n*(n-1))) : 0;
    document.getElementById('s-nodes').textContent = n;
    document.getElementById('s-edges').textContent = m;
    document.getElementById('s-maxdeg').textContent = maxD;
    document.getElementById('s-avgdeg').textContent = avgD.toFixed(2);
    document.getElementById('s-density').textContent = dens.toFixed(3);
}

export function update_progress(steps, stepIdx) {
    const pct = steps.length ? (stepIdx / (steps.length-1)) * 100 : 0;
    document.getElementById('progressbar').style.width = pct + '%';
    document.getElementById('step-badge').textContent = `${stepIdx} / ${steps.length - 1}`;
}

export function stop(state) {
    if (state.timer) clearTimeout(state.timer);
    state.running = false;
    document.getElementById('btn-run').textContent = '▶ RUN';
    set_status(`Done. ${state.steps.length-1} steps.`, false);
}

export function tick(state, renderer) {
    if (!state.running) return;
    if (state.stepIdx >= state.steps.length - 1) { stop(state); return; }
    state.stepIdx++;
    renderer.update(state.steps[state.stepIdx]);
    update_properties(state.steps[state.stepIdx]);
    update_progress(state.steps, state.stepIdx);
    state.timer = setTimeout(() => tick(state, renderer), get_speed());
}

export function run(gen, state, renderer) {
    if (state.running) { stop(state); return; }
    if (state.stepIdx >= state.steps.length - 1) {
        // restart
        state.steps = gen.build(get_params(gen.params));
        state.stepIdx = 0;
        renderer.clear();
    }
    state.running = true;
    document.getElementById('btn-run').textContent = '⏸ PAUSE';
    set_status(`Running ${gen.label}…`, true);
    tick(state, renderer);
}

export function reset(gen, state, renderer) {
  stop(state);
  state.steps = gen.build(get_params(gen.params));
  state.stepIdx = 0;
  renderer.clear();
  update_properties({ nodes:[], edges:[] });
  update_progress(state.steps, state.stepIdx);
  set_status('Reset. Press RUN to start.', false);
}
