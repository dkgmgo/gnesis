import * as utils from './front_utils.js';
import { GraphRenderer } from './vis/renderers.js';
import { DegreeChart } from './vis/charts.js';
import { CliqueFiltrationRenderer } from './vis/renderers.js';

const RENDERER = new GraphRenderer(document.getElementById('graph-svg'));
const DEG_CHART = new DegreeChart(document.getElementById('deg-chart-svg'));
const FILT_REND = new CliqueFiltrationRenderer(RENDERER, document.getElementById('filt-chart-svg'));
const BTN_FILT = document.getElementById('btn-filt');
const GENERATORS = utils.list_generators();
let state = {
    currentGen : '2d-grid',
    steps: [],
    stepIdx: 0,
    running: false,
    timer: null,
    filtrationActive: false
};

document.getElementById('btn-run').addEventListener('click', () => {
    if (state.steps.length === 0){
        state.steps = utils.build_steps(GENERATORS[state.currentGen], utils.get_params(GENERATORS[state.currentGen].params));
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
state.steps = utils.build_steps(GENERATORS[state.currentGen], utils.get_params(GENERATORS[state.currentGen].params));
utils.set_status('Ready. Press RUN to start.', false);
