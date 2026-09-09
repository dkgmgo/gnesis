import { GridGenerator } from "./generators/grid.js";
import { BarabasiAlbertGenerator } from "./generators/barabasi_albert.js";
import { ErdosRenyiGenerator } from "./generators/erdos_renyi.js";
import { WattsStrogatzGenerator } from "./generators/watts-strogatz.js";
import { RGGGenerator } from "./generators/geometric.js";
import { SBMGenerator } from "./generators/sbm.js";
import { closeness_centrality, ollivier_ricci_curvature } from "./back_utils.js";

const grid_gen = new GridGenerator();
const ba_gen = new BarabasiAlbertGenerator();
const er_gen = new ErdosRenyiGenerator();
const ws_gen = new WattsStrogatzGenerator();
const rgg_gen = new RGGGenerator();
const sbm_gen = new SBMGenerator();

export function list_generators() {
    return {
        '2d-grid': grid_gen,
        'erdos-renyi': er_gen,
        'watts-strogatz': ws_gen,
        'barabasi-albert': ba_gen,
        'random-geometric': rgg_gen,
        'sbm': sbm_gen
    }
}

export function build_generators_select(gens, currentGen) {
    const select = document.getElementById('generators-select');
    select.innerHTML = '';
    Object.values(gens).forEach(gen => {
        const opt = document.createElement('option');
        opt.value = gen.id;
        opt.textContent = gen.label
        if(gen.id === currentGen){
            opt.selected = true;
        }
        select.appendChild(opt)
    });
}

export function get_speed() {
    const v = +document.getElementById('speed-range').value;
    return Math.round(1000 / (v * v * 0.01 + 2));
}

export function build_params_panel(gen) {
    const panel = document.getElementById('params-panel');
    panel.innerHTML = '<div class="section-label">Parameters</div>'; // reset
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

//the file may already carry curvature for every edge.
const METRICS = {
    closeness: { label: 'Closeness', btn: 'btn-closeness', run: closeness_centrality,
                 complete: snap => (snap.nodes ?? []).every(n => typeof n._closeness === 'number') },
    curvature: { label: 'Curvature', btn: 'btn-curvature', run: ollivier_ricci_curvature,
                 complete: snap => (snap.edges ?? []).every(e => typeof e._curv === 'number') }
};

export function current_snapshot(state) {
    return state.steps[state.stepIdx] ?? null;
}

export function update_metric_buttons(state) {
    const snap = current_snapshot(state);
    for (const m of Object.values(METRICS)) {
        const btn = document.getElementById(m.btn);
        if (!btn) continue;
        const done = !!snap && m.complete(snap);
        btn.disabled = !snap || state.running || done;
        btn.classList.toggle('done', done);
        btn.title = done ? `${m.label} already available for every element.` : '';
    }
}

function after_paint(fn) {
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(fn));
    } else {
        fn();
    }
}

export function compute_metric(kind, state, renderer) {
    const snap = current_snapshot(state);
    const m = METRICS[kind];
    if (!snap || !m || state.running || m.complete(snap)) return;

    set_status(`Computing ${m.label.toLowerCase()}…`, true);
    after_paint(() => {
        m.run(snap);
        renderer.update(snap);          // repaint: hub highlight, edge colours
        update_metric_buttons(state);
        set_status(`${m.label} computed.`, false);
    });
}

export function set_status(msg, active=false, is_error=false) {
    let status_msg = document.getElementById('status-msg')
    status_msg.textContent = msg;
    status_msg.className = is_error ? 'error' : '';
    document.getElementById('status-dot').className = 'dot' + (active ? '' : ' idle');
}

export function update_properties(snap, deg_chart) {
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
    deg_chart.update(snap)
}

export function update_progress(steps, stepIdx) {
    // an imported graph is one snapshot, so there is no range: show it complete
    const last = steps.length - 1;
    const pct = last > 0 ? (stepIdx / last) * 100 : (steps.length ? 100 : 0);
    document.getElementById('progressbar').style.width = pct + '%';
    document.getElementById('step-badge').textContent = `${stepIdx} / ${Math.max(last, 0)}`;
}

export function stop(state) {
    if (state.timer) clearTimeout(state.timer);
    state.running = false;
    document.getElementById('btn-run').textContent = '▶ RUN';
    update_metric_buttons(state);
    set_status(`Done. ${state.steps.length-1} steps.`, false);
}

export function tick(state, renderer, deg_chart) {
    if (!state.running) return;
    if (state.stepIdx >= state.steps.length - 1) { stop(state); return; }
    state.stepIdx++;
    renderer.update(state.steps[state.stepIdx]);
    update_properties(state.steps[state.stepIdx], deg_chart);
    update_progress(state.steps, state.stepIdx);
    update_metric_buttons(state);
    state.timer = setTimeout(() => tick(state, renderer, deg_chart), get_speed());
}

export function run(gen, state, renderer, deg_chart) {
    if (state.running) { 
        stop(state); return; 
    }

    const params = get_params(gen.params);
    const params_not_ok = gen.check_params ? gen.check_params(params) : null;
    if (params_not_ok) {
        set_status(params_not_ok, true, true);
        build_params_panel(gen);
        return;
    }

    if (state.stepIdx >= state.steps.length - 1) {
        // restart
        state.steps = gen.build(params);
        state.stepIdx = 0;
        renderer.clear();
    }
    state.running = true;
    document.getElementById('btn-run').textContent = '⏸ PAUSE';
    update_metric_buttons(state);
    set_status(`Running ${gen.label}…`, true);
    tick(state, renderer, deg_chart);
}

export function reset(gen, state, renderer, deg_chart) {
    stop(state);

    const params = get_params(gen.params);
    const params_not_ok = gen.check_params ? gen.check_params(params) : null;
    if (params_not_ok) {
        set_status(params_not_ok, true, true);
        build_params_panel(gen);
        return;
    }

    state.steps = gen.build(params);
    state.stepIdx = 0;
    renderer.clear();
    deg_chart.clear();
    update_properties({ nodes:[], edges:[] }, deg_chart);
    update_progress(state.steps, state.stepIdx);
    update_metric_buttons(state);
    set_status('Reset. Press RUN to start.', false);
}

function reset_filt_ui(state, btn_filt, status) {
    state.filtrationActive = false;
    btn_filt.textContent = '◆ FILTRATION';
    btn_filt.classList.remove('filt-active');
    set_status(status, false);
}

export function stop_filtration(state, filt_rend, btn_filt) {
    filt_rend.clear();
    if (state.filtrationActive) {
        reset_filt_ui(state, btn_filt, 'Filtration stopped.');
    }
}

export function filtration(gen, state, filt_rend, btn_filt){
    if(state.filtrationActive){
        stop_filtration(state, filt_rend, btn_filt);
    }else {
        if (!filt_rend.gr.nodes.length) {
            set_status('Generate a graph first, then run the filtration.', false, true);
            return;
        }
        if (state.running) {
            set_status('Wait for the completion of graph generation, then run the filtration.', false, true);
            return;
        }
 
        state.filtrationActive = true;
        btn_filt.textContent = '⏹ STOP FILTRATION';
        btn_filt.classList.add('filt-active');
        set_status('Filtration running…', true);
 
        filt_rend.onDone = () => {
            // no clear(): the finished curve and balls stay on screen
            reset_filt_ui(state, btn_filt, 'Filtration complete.');
        };
 
        filt_rend.start(get_speed());
    }
}


// The filename comes from the user's own file, so it is escaped
const escape_html = str => String(str).replace(/[&<>"]/g,
    c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

export function show_file_info(imported, error) {
    const box = document.getElementById('file-info');
    if (error) { box.innerHTML = `<div class="err">${escape_html(error)}</div>`; return; }
    if (!imported) { box.innerHTML = ''; return; }
    const { name, nodes, edges, warnings, read } = imported;
    const lines = [`<div class="name">${escape_html(name)}</div>`,
                   `<div>${nodes.length} nodes · ${edges.length} edges</div>`];
    if (read) {
        const got = Object.entries(read).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`);
        if (got.length) lines.push(`<div>from file: ${got.join(' · ')}</div>`);
    }
    for (const w of warnings) lines.push(`<div class="warn">${escape_html(w)}</div>`);
    box.innerHTML = lines.join('');
}

// An imported graph has no construction history, so it is a single snapshot.
export function show_imported(state, renderer, deg_chart) {
    renderer.clear();
    deg_chart.clear();

    if (!state.imported) {
        state.steps = [];
        state.stepIdx = 0;
        update_properties({ nodes: [], edges: [] }, deg_chart);
        update_progress(state.steps, 0);
        update_metric_buttons(state);
        set_status('Load a GraphML file to inspect a graph.', false);
        return;
    }

    const { nodes, edges, name } = state.imported;
    state.steps = [{ nodes, edges }];
    state.stepIdx = 0;
    renderer.update(state.steps[0]);
    update_properties(state.steps[0], deg_chart);
    update_progress(state.steps, 0);
    update_metric_buttons(state);
    set_status(`${name}: ${nodes.length} nodes, ${edges.length} edges.`, false);
}

export function set_mode(mode, state, gen, renderer, deg_chart, filt_rend, btn_filt) {
    if (state.mode === mode) return;

    stop_filtration(state, filt_rend, btn_filt);
    stop(state);

    state.mode = mode;
    document.getElementById('app').dataset.mode = mode;
    document.querySelectorAll('#tab-bar .tab').forEach(tab =>
        tab.classList.toggle('active', tab.dataset.mode === mode));

    if (mode === 'generate') {
        reset(gen, state, renderer, deg_chart);
    } else {
        show_imported(state, renderer, deg_chart);
    }
}
