import * as utils from './front_utils.js';
import { GraphRenderer } from './renderer.js';

const RENDERER = new GraphRenderer(document.getElementById('graph-svg'));
const GENERATORS = utils.list_generators();
let state = {
    currentGen : '2d-grid',
    steps: [],
    stepIdx: 0,
    running: false,
    timer: null,
};

document.getElementById('btn-run').addEventListener('click', () => {
    if (state.steps.length === 0){
        state.steps = GENERATORS[state.currentGen].build(utils.get_params(GENERATORS[state.currentGen].params));
    }
    utils.run(GENERATORS[state.currentGen], state, RENDERER);
});

document.getElementById('btn-reset').addEventListener('click', () => {
    utils.reset(GENERATORS[state.currentGen], state, RENDERER);
});

document.getElementById('speed-range').addEventListener('input', e => {
    document.getElementById('speed-val').textContent = e.target.value;
});

new ResizeObserver(entries => {
    const {width, height} = entries[0].contentRect;
    RENDERER.resize(width, height);
}).observe(document.getElementById('canvas-area'));


utils.build_generators_panel(GENERATORS, state.currentGen);

document.querySelectorAll('.gen-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        utils.stop(state);
        document.querySelectorAll('.gen-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentGen = btn.dataset.gen;
        utils.build_params_panel(GENERATORS[state.currentGen]);
        utils.reset(GENERATORS[state.currentGen], state, RENDERER);
    });
});

utils.build_params_panel(GENERATORS[state.currentGen]);
state.steps = GENERATORS[state.currentGen].build(utils.get_params(GENERATORS[state.currentGen].params));
utils.set_status('Ready. Press RUN to start.', false);
