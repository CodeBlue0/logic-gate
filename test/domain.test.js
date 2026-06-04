import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INPUT_MODES,
  circuitDefinitions,
  commitEvaluation,
  createCircuitState,
  evaluateCircuit,
  getCircuit,
  nextInputMode,
  tapInput
} from '../src/domain.js';

test('registry contains the current gate set', () => {
  assert.deepEqual(circuitDefinitions.map((circuit) => circuit.name), [
    'Line', 'NOT', 'AND', 'OR', 'NOR', 'SR latch', 'D latch', 'D flipflop', 'Counter'
  ]);
});

test('input state cycle is 0 -> 1 -> 0', () => {
  assert.equal(nextInputMode(INPUT_MODES.ZERO), INPUT_MODES.ONE);
  assert.equal(nextInputMode(INPUT_MODES.ONE), INPUT_MODES.ZERO);
  const circuit = getCircuit('not');
  let state = createCircuitState(circuit);
  assert.equal(state.inputs.A.mode, INPUT_MODES.ZERO);
  assert.equal(state.inputs.A.value, 0);
  state = tapInput(state, 'A');
  assert.equal(state.inputs.A.mode, INPUT_MODES.ONE);
  assert.equal(state.inputs.A.value, 1);
  state = tapInput(state, 'A');
  assert.equal(state.inputs.A.mode, INPUT_MODES.ZERO);
  assert.equal(state.inputs.A.value, 0);
});

const truthCases = [
  ['line', [{ A: 0, Y: 0 }, { A: 1, Y: 1 }]],
  ['not', [{ A: 0, Y: 1 }, { A: 1, Y: 0 }]],
  ['and', [{ A: 0, B: 0, Y: 0 }, { A: 0, B: 1, Y: 0 }, { A: 1, B: 0, Y: 0 }, { A: 1, B: 1, Y: 1 }]],
  ['or', [{ A: 0, B: 0, Y: 0 }, { A: 0, B: 1, Y: 1 }, { A: 1, B: 0, Y: 1 }, { A: 1, B: 1, Y: 1 }]],
  ['nor', [{ A: 0, B: 0, Y: 1 }, { A: 0, B: 1, Y: 0 }, { A: 1, B: 0, Y: 0 }, { A: 1, B: 1, Y: 0 }]]
];

for (const [circuitId, cases] of truthCases) {
  test(`${circuitId} truth table`, () => {
    const circuit = getCircuit(circuitId);
    for (const row of cases) {
      const state = createCircuitState(circuit);
      for (const input of circuit.inputs) {
        state.inputs[input.id].value = row[input.id];
        state.inputs[input.id].mode = row[input.id] ? INPUT_MODES.ONE : INPUT_MODES.ZERO;
      }
      const evaluation = evaluateCircuit(circuit, state);
      assert.equal(evaluation.outputs.Y, row.Y, JSON.stringify(row));
    }
  });
}

test('D latch follows when enabled and holds when disabled', () => {
  const circuit = getCircuit('d-latch');
  let state = createCircuitState(circuit);
  state.inputs.D.value = 1;
  state.inputs.EN.value = 1;
  let evaluation = evaluateCircuit(circuit, state);
  assert.equal(evaluation.outputs.Q, 1);
  assert.equal(evaluation.status, 'transparent');
  state = commitEvaluation(state, evaluation);

  state.inputs.EN.value = 0;
  state.inputs.D.value = 0;
  evaluation = evaluateCircuit(circuit, state);
  assert.equal(evaluation.outputs.Q, 1);
  assert.equal(evaluation.status, 'holding');
});

test('D flipflop transfers master latch value when CLK opens the slave latch', () => {
  const circuit = getCircuit('d-flipflop');
  let state = createCircuitState(circuit);

  state.inputs.D.value = 1;
  state.inputs.CLK.value = 1;
  let evaluation = evaluateCircuit(circuit, state);
  assert.deepEqual(evaluation.outputs, { Q: 0 });
  assert.deepEqual(evaluation.memory, { master: 0, Q: 0 });
  assert.equal(evaluation.status, 'slave');

  state.inputs.CLK.value = 0;
  evaluation = evaluateCircuit(circuit, state);
  assert.deepEqual(evaluation.outputs, { Q: 0 });
  assert.deepEqual(evaluation.memory, { master: 1, Q: 0 });
  assert.equal(evaluation.status, 'master');
  state = commitEvaluation(state, evaluation);

  state.inputs.D.value = 0;
  state.inputs.CLK.value = 1;
  evaluation = evaluateCircuit(circuit, state);
  assert.deepEqual(evaluation.outputs, { Q: 1 });
  assert.deepEqual(evaluation.memory, { master: 1, Q: 1 });
  assert.equal(evaluation.status, 'slave');
});

test('Counter follows the cascaded D flipflop ripple loop on CLK rising edge', () => {
  const circuit = getCircuit('counter');
  let state = createCircuitState(circuit);
  let evaluation = evaluateCircuit(circuit, state);
  assert.deepEqual(evaluation.outputs, { NQ1: 0, NQ2: 0, NQ3: 0 });

  const expected = [
    { NQ1: 0, NQ2: 0, NQ3: 1 },
    { NQ1: 0, NQ2: 1, NQ3: 0 },
    { NQ1: 0, NQ2: 1, NQ3: 1 },
    { NQ1: 1, NQ2: 0, NQ3: 0 },
    { NQ1: 1, NQ2: 0, NQ3: 1 },
    { NQ1: 1, NQ2: 1, NQ3: 0 },
    { NQ1: 1, NQ2: 1, NQ3: 1 },
    { NQ1: 0, NQ2: 0, NQ3: 0 }
  ];

  for (const output of expected) {
    state.inputs.CLK.value = 1;
    evaluation = evaluateCircuit(circuit, state);
    assert.deepEqual(evaluation.outputs, output);
    assert.equal(evaluation.status, 'shift');
    state = commitEvaluation(state, evaluation);

    state.inputs.CLK.value = 0;
    evaluation = evaluateCircuit(circuit, state);
    assert.deepEqual(evaluation.outputs, output);
    assert.equal(evaluation.status, 'holding');
    state = commitEvaluation(state, evaluation);
  }
});



test('SR latch sets, resets, holds, and flags invalid state', () => {
  const circuit = getCircuit('sr-latch');
  let state = createCircuitState(circuit);
  let evaluation = evaluateCircuit(circuit, state);
  assert.deepEqual(evaluation.outputs, { Q: 0, NQ: 1 });

  state.inputs.S.value = 1;
  state.inputs.R.value = 0;
  evaluation = evaluateCircuit(circuit, state);
  assert.deepEqual(evaluation.outputs, { Q: 1, NQ: 0 });
  assert.equal(evaluation.status, 'set');
  state = commitEvaluation(state, evaluation);

  state.inputs.S.value = 0;
  evaluation = evaluateCircuit(circuit, state);
  assert.deepEqual(evaluation.outputs, { Q: 1, NQ: 0 });
  assert.equal(evaluation.status, 'holding');

  state.inputs.R.value = 1;
  evaluation = evaluateCircuit(circuit, state);
  assert.deepEqual(evaluation.outputs, { Q: 0, NQ: 1 });
  assert.equal(evaluation.status, 'reset');

  state.inputs.S.value = 1;
  evaluation = evaluateCircuit(circuit, state);
  assert.deepEqual(evaluation.outputs, { Q: 0, NQ: 0 });
  assert.equal(evaluation.status, 'invalid');
});

test('switching circuits creates deterministic reset state', () => {
  const andState = createCircuitState(getCircuit('and'));
  assert.equal(andState.inputs.A.value, 0);
  assert.equal(andState.inputs.B.value, 0);
  const latchState = createCircuitState(getCircuit('sr-latch'));
  assert.deepEqual(latchState.memory, { Q: 0, NQ: 1 });
  const flipflopState = createCircuitState(getCircuit('d-flipflop'));
  assert.deepEqual(flipflopState.memory, { master: 0, Q: 0 });
  const counterState = createCircuitState(getCircuit('counter'));
  assert.deepEqual(counterState.memory, { Q3: 1, Q2: 1, Q1: 1, prevCLK: 0 });
});
