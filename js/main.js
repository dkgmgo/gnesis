import * as utils from './front_utils.js';
import { parse_graphml } from './files/graphml.js';
import { GraphRenderer } from './vis/renderers.js';
import { DegreeChart } from './vis/charts.js';
import { CliqueFiltrationRenderer } from './vis/renderers.js';

const RENDERER = new GraphRenderer(document.getElementById('graph-svg'));
const DEG_CHART = new DegreeChart(document.getElementById('deg-chart-svg'));
const FILT_REND = new CliqueFiltrationRenderer(RENDERER, document.getElementById('filt-chart-svg'));
const BTN_FILT = document.getElementById('btn-filt');
const GENERATORS = utils.list_generators();
let state = {
    mode: 'generate',
    imported: null,
    currentGen : '2d-grid',
    steps: [],
    stepIdx: 0,
    running: false,
    timer: null,
    filtrationActive: false
};

document.getElementById('btn-run').addEventListener('click', () => {
    if (state.steps.length === 0){
        state.steps = GENERATORS[state.currentGen].build(utils.get_params(GENERATORS[state.currentGen].params));
    }
    utils.stop_filtration(state, FILT_REND, BTN_FILT);
    utils.run(GENERATORS[state.currentGen], state, RENDERER, DEG_CHART);
});

document.getElementById('btn-reset').addEventListener('click', () => {
    utils.stop_filtration(state, FILT_REND, BTN_FILT);
    utils.reset(GENERATORS[state.currentGen], state, RENDERER, DEG_CHART);
});

BTN_FILT.addEventListener('click', () => {
    utils.filtration(GENERATORS[state.currentGen], state, FILT_REND, BTN_FILT)
});

for (const [kind, id] of [['closeness', 'btn-closeness'], ['curvature', 'btn-curvature']]) {
    document.getElementById(id).addEventListener('click',
        () => utils.compute_metric(kind, state, RENDERER));
}

document.querySelectorAll('#tab-bar .tab').forEach(tab => {
    tab.addEventListener('click', () => utils.set_mode(
        tab.dataset.mode, state, GENERATORS[state.currentGen],
        RENDERER, DEG_CHART, FILT_REND, BTN_FILT));
});

document.getElementById('file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = ''; // so re-picking the same file still fires a change
    if (!file) return;
    try {
        const { nodes, edges, warnings, read } = parse_graphml(await file.text());
        state.imported = { name: file.name, nodes, edges, warnings, read };
        utils.show_file_info(state.imported);
        utils.show_imported(state, RENDERER, DEG_CHART);
    } catch (err) {
        state.imported = null;
        utils.show_file_info(null, err.message);
        utils.show_imported(state, RENDERER, DEG_CHART);
        utils.set_status(err.message, false, true);
    }
});

document.getElementById('speed-range').addEventListener('input', e => {
    document.getElementById('speed-val').textContent = e.target.value;
});

new ResizeObserver(entries => {
    const {width, height} = entries[0].contentRect;
    RENDERER.resize(width, height);
}).observe(document.getElementById('canvas-area'));


utils.build_generators_select(GENERATORS, state.currentGen);

const select = document.getElementById('generators-select');
select.addEventListener('change', () => {
    utils.stop_filtration(state, FILT_REND, BTN_FILT);
    utils.stop(state);
    state.currentGen = select.value;
    document.getElementById('gen-desc').textContent = GENERATORS[state.currentGen].description;
    utils.build_params_panel(GENERATORS[state.currentGen]);
    utils.reset(GENERATORS[state.currentGen], state, RENDERER, DEG_CHART);
});

document.getElementById('gen-desc').textContent = GENERATORS[state.currentGen].description;
utils.build_params_panel(GENERATORS[state.currentGen]);
state.steps = GENERATORS[state.currentGen].build(utils.get_params(GENERATORS[state.currentGen].params));
utils.update_metric_buttons(state, RENDERER);
utils.set_status('Ready. Press RUN to start.', false);
