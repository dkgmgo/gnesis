import * as utils from './front_utils.js';
import { GraphRenderer } from './vis/renderers.js';
import { DegreeChart } from './vis/charts.js';
import { RipsFiltrationRenderer } from './vis/renderers.js';

const RENDERER = new GraphRenderer(document.getElementById('graph-svg'));
const DEG_CHART = new DegreeChart(document.getElementById('deg-chart-svg'));
const FILT_REND = new RipsFiltrationRenderer(RENDERER, document.getElementById('filt-chart-svg'));
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
        state.steps = GENERATORS[state.currentGen].build(utils.get_params(GENERATORS[state.currentGen].params));
    }
    FILT_REND.clear()
    utils.run(GENERATORS[state.currentGen], state, RENDERER, DEG_CHART);
});

document.getElementById('btn-reset').addEventListener('click', () => {
    FILT_REND.clear()
    utils.reset(GENERATORS[state.currentGen], state, RENDERER, DEG_CHART);
});

document.getElementById('btn-filt').addEventListener('click', () => {
    utils.filtration(GENERATORS[state.currentGen], state, FILT_REND, document.getElementById('btn-filt'))
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
    FILT_REND.clear();
    utils.stop(state);
    state.currentGen = select.value;
    document.getElementById('gen-desc').textContent = GENERATORS[state.currentGen].description;
    utils.build_params_panel(GENERATORS[state.currentGen]);
    utils.reset(GENERATORS[state.currentGen], state, RENDERER, DEG_CHART);
});

document.getElementById('gen-desc').textContent = GENERATORS[state.currentGen].description;
utils.build_params_panel(GENERATORS[state.currentGen]);
state.steps = GENERATORS[state.currentGen].build(utils.get_params(GENERATORS[state.currentGen].params));
utils.set_status('Ready. Press RUN to start.', false);
