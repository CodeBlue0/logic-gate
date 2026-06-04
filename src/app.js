import {
  INPUT_MODES,
  circuitDefinitions,
  commitEvaluation,
  createCircuitState,
  evaluateCircuit,
  getCircuit,
  tapInput
} from './domain.js';

const app = document.querySelector('#app');
const WIRE_FILL_MS = 1250;
const WIRE_NODE_COUNT = 20;
const WIRE_NODE_STEP_MS = WIRE_FILL_MS / WIRE_NODE_COUNT;
const POWER_BAND_HALF_HEIGHT = 2;

let activeCircuit = circuitDefinitions[0];
let state = createCircuitState(activeCircuit);
let gateState = createCircuitState(activeCircuit);
let evaluation = evaluateCircuit(activeCircuit, gateState);
let visibleEvaluation = structuredClone(evaluation);
let pulseKey = 0;
let wireNodeValues = new Map();
let visualLatchMemory = visualLatchMemoryFor(activeCircuit, evaluation);

app.addEventListener('pointerdown', (event) => {
  const control = event.target.closest('[data-input]');
  if (control && app.contains(control)) {
    event.preventDefault();
    handleInputTap(control.dataset.input);
    return;
  }

  const button = event.target.closest('[data-circuit]');
  if (button && app.contains(button)) {
    event.preventDefault();
    setCircuit(button.dataset.circuit);
  }
});

app.addEventListener('keydown', (event) => {
  const control = event.target.closest('[data-input]');
  const button = event.target.closest('[data-circuit]');
  if ((!control && !button) || !app.contains(event.target)) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  if (control) handleInputTap(control.dataset.input);
  if (button) setCircuit(button.dataset.circuit);
});


function setCircuit(id) {
  activeCircuit = getCircuit(id);
  state = createCircuitState(activeCircuit);
  gateState = createCircuitState(activeCircuit);
  evaluation = evaluateCircuit(activeCircuit, gateState);
  visibleEvaluation = structuredClone(evaluation);
  visualLatchMemory = visualLatchMemoryFor(activeCircuit, evaluation);
  wireNodeValues = initialWireNodeValues();
  pulseKey += 1;
  render();
}

function visualLatchMemoryFor(circuit, currentEvaluation) {
  if (circuit.gate.type !== 'd-flipflop') return {};
  return {
    master: currentEvaluation.memory?.master ? 1 : 0,
    slave: currentEvaluation.memory?.Q ? 1 : 0
  };
}

function isTopDownCircuit() {
  return ['d-latch', 'd-flipflop'].includes(activeCircuit.gate.type);
}

function snapshotForRender(currentSourceState, currentGateState, currentEvaluation) {
  return JSON.stringify({
    circuitId: activeCircuit.id,
    sourceInputs: currentSourceState.inputs,
    gateInputs: currentGateState.inputs,
    memory: currentGateState.memory,
    outputs: currentEvaluation.outputs,
    status: currentEvaluation.status
  });
}

function updateState(nextState) {
  const before = snapshotForRender(state, gateState, evaluation);
  state = { ...nextState, memory: gateState.memory };
  const after = snapshotForRender(state, gateState, evaluation);
  if (before === after) return;
  pulseKey += 1;
  render();
}

function handleInputTap(inputId) {
  updateState(tapInput(state, inputId), 'change');
}


setInterval(() => {
  if (advanceWireNodes()) render();
}, WIRE_NODE_STEP_MS);

function gateInputPoint(wire) {
  const gate = activeCircuit.gate;
  const input = activeCircuit.inputs.find((item) => item.id === wire.from);
  if (isTopDownCircuit()) {
    return { x: input?.x ?? gate.x + gate.w / 2, y: gate.y };
  }
  if (gate.type === 'sr-latch' && activeCircuit.internal?.gates) {
    const [top, bottom] = activeCircuit.internal.gates;
    const internalGate = wire.from === 'S' ? top : bottom;
    return { x: internalGate.x, y: input?.y ?? internalGate.y + internalGate.h / 2 };
  }
  return { x: gate.x, y: input?.y ?? gate.y + gate.h / 2 };
}

function gateOutputPoint(wire) {
  const gate = activeCircuit.gate;
  const output = activeCircuit.outputs.find((item) => item.id === wire.to || item.id === wire.outputId);
  if (isTopDownCircuit()) {
    return { x: (output?.x ?? gate.x + gate.w / 2) + 3, y: gate.y + gate.h };
  }
  if (gate.type === 'sr-latch' && activeCircuit.internal?.gates) {
    const [top, bottom] = activeCircuit.internal.gates;
    const internalGate = wire.outputId === 'NQ' ? top : bottom;
    return { x: internalGate.x + internalGate.w + 10, y: output?.y ?? internalGate.y + internalGate.h / 2 };
  }
  const bubbleOffset = gate.type === 'not' || gate.type === 'nor' ? 8 : 0;
  return { x: gate.x + gate.w + bubbleOffset + 2, y: output?.y ?? gate.y + gate.h / 2 };
}

function pointFor(ref, wire, role) {
  if (ref === 'gate') {
    return role === 'from' ? gateOutputPoint(wire) : gateInputPoint(wire);
  }
  const input = activeCircuit.inputs.find((item) => item.id === ref);
  if (input && isTopDownCircuit()) return { x: input.x, y: input.y + 18 };
  if (input) return { x: input.x + 26, y: input.y };
  const output = activeCircuit.outputs.find((item) => item.id === ref);
  if (output && isTopDownCircuit()) return { x: output.x + 3, y: output.y - 16 };
  if (output) return { x: output.x - 18, y: output.y };
  return { x: 0, y: 0 };
}

function wireEndpoints(wire) {
  if (wire.points) {
    return {
      from: wire.points[0],
      to: wire.points[wire.points.length - 1]
    };
  }
  if (wire.curve) {
    return {
      from: wire.curve.from,
      to: wire.curve.to
    };
  }
  return {
    from: pointFor(wire.from, wire, 'from'),
    to: pointFor(wire.to, wire, 'to')
  };
}

function wireCurvePoints(wire) {
  if (wire.curve) return wire.curve;
  const { from, to } = wireEndpoints(wire);
  const mid = Math.round((from.x + to.x) / 2);
  const gateCenterY = activeCircuit.gate.y + activeCircuit.gate.h / 2;
  const sameLevel = Math.abs(from.y - to.y) < 1;
  const bend = sameLevel
    ? (wire.to === 'gate'
        ? (from.y < gateCenterY ? 0.1 : -0.1)
        : -0.1)
    : 0;
  return {
    from,
    c1: { x: mid, y: from.y + bend },
    c2: { x: mid, y: to.y + bend },
    to
  };
}

function wirePath(wire) {
  if (wire.points) {
    const [first, ...rest] = wire.points;
    return `M ${first.x} ${first.y} ${rest.map((point) => `L ${point.x} ${point.y}`).join(' ')}`;
  }
  const { from, c1, c2, to } = wireCurvePoints(wire);
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
}

function cubicPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return {
    x: (mt ** 3 * p0.x) + (3 * mt ** 2 * t * p1.x) + (3 * mt * t ** 2 * p2.x) + (t ** 3 * p3.x),
    y: (mt ** 3 * p0.y) + (3 * mt ** 2 * t * p1.y) + (3 * mt * t ** 2 * p2.y) + (t ** 3 * p3.y)
  };
}

function wirePointAt(wire, t) {
  if (wire.points) return polylinePointAt(wire.points, t);
  const { from, c1, c2, to } = wireCurvePoints(wire);
  return cubicPoint(from, c1, c2, to, t);
}

function polylinePointAt(points, t) {
  const segments = [];
  let totalLength = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    segments.push({ from, to, length });
    totalLength += length;
  }
  if (!totalLength) return points[0] ?? { x: 0, y: 0 };
  let target = totalLength * Math.max(0, Math.min(1, t));
  for (const segment of segments) {
    if (target > segment.length) {
      target -= segment.length;
      continue;
    }
    const ratio = segment.length ? target / segment.length : 0;
    return {
      x: segment.from.x + ((segment.to.x - segment.from.x) * ratio),
      y: segment.from.y + ((segment.to.y - segment.from.y) * ratio)
    };
  }
  return points[points.length - 1];
}

function powerBandPoints(centerPoints) {
  const upperPoints = [];
  const lowerPoints = [];
  for (let index = 0; index < centerPoints.length; index += 1) {
    const point = centerPoints[index];
    const prev = centerPoints[Math.max(0, index - 1)];
    const next = centerPoints[Math.min(centerPoints.length - 1, index + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const length = Math.hypot(dx, dy) || 1;
    const normal = {
      x: -dy / length,
      y: dx / length
    };
    upperPoints.push(`${(point.x + (normal.x * POWER_BAND_HALF_HEIGHT)).toFixed(2)},${(point.y + (normal.y * POWER_BAND_HALF_HEIGHT)).toFixed(2)}`);
    lowerPoints.push(`${(point.x - (normal.x * POWER_BAND_HALF_HEIGHT)).toFixed(2)},${(point.y - (normal.y * POWER_BAND_HALF_HEIGHT)).toFixed(2)}`);
  }
  return [...upperPoints, ...lowerPoints.reverse()].join(' ');
}

function orShapePath(gate) {
  return `M ${gate.x} ${gate.y + gate.h * 0.05} C ${gate.x + gate.w * 0.4} ${gate.y + gate.h * 0.15}, ${gate.x + gate.w * 0.75} ${gate.y}, ${gate.x + gate.w} ${gate.y + gate.h / 2} C ${gate.x + gate.w * 0.75} ${gate.y + gate.h}, ${gate.x + gate.w * 0.4} ${gate.y + gate.h * 0.85}, ${gate.x} ${gate.y + gate.h * 0.95} C ${gate.x + gate.w * 0.2} ${gate.y + gate.h * 0.7}, ${gate.x + gate.w * 0.2} ${gate.y + gate.h * 0.3}, ${gate.x} ${gate.y + gate.h * 0.05} Z`;
}

function andShapePath(gate) {
  return `M ${gate.x} ${gate.y} H ${gate.x + gate.w / 2} A ${gate.w / 2} ${gate.h / 2} 0 0 1 ${gate.x + gate.w / 2} ${gate.y + gate.h} H ${gate.x} Z`;
}

function downAndShapePath(gate) {
  return `M ${gate.x} ${gate.y} H ${gate.x + gate.w} V ${gate.y + gate.h / 2} A ${gate.w / 2} ${gate.h / 2} 0 0 1 ${gate.x} ${gate.y + gate.h / 2} Z`;
}

function internalFeedbackWires() {
  if (activeCircuit.gate.type !== 'sr-latch' || !activeCircuit.internal?.gates) return [];
  const [top, bottom] = activeCircuit.internal.gates;
  return [
    {
      id: 'feedback-NQ-to-bottom-NOR',
      outputId: 'NQ',
      curve: {
        from: { x: top.x + top.w + 11, y: top.y + top.h / 2 },
        c1: { x: top.x + top.w + 34, y: top.y + 33 },
        c2: { x: bottom.x - 28, y: bottom.y + 5 },
        to: { x: bottom.x, y: bottom.y + 11 }
      }
    },
    {
      id: 'feedback-Q-to-top-NOR',
      outputId: 'Q',
      curve: {
        from: { x: bottom.x + bottom.w + 11, y: bottom.y + bottom.h / 2 },
        c1: { x: bottom.x + bottom.w + 34, y: bottom.y + 1 },
        c2: { x: top.x - 28, y: top.y + 29 },
        to: { x: top.x, y: top.y + 23 }
      }
    }
  ];
}

function internalCircuitWires() {
  const gate = activeCircuit.gate;
  if (gate.type === 'd-latch') {
    return [
      { id: 'd-in-to-not', sourceSignal: 'D', curve: { from: { x: 80, y: 76 }, c1: { x: 80, y: 88 }, c2: { x: 80, y: 96 }, to: { x: 80, y: 104 } } },
      { id: 'd-in-to-set-and', sourceSignal: 'D', curve: { from: { x: 80, y: 76 }, c1: { x: 132, y: 104 }, c2: { x: 202, y: 132 }, to: { x: 217, y: 164 } } },
      { id: 'en-to-reset-and', sourceSignal: 'EN', curve: { from: { x: 240, y: 76 }, c1: { x: 238, y: 118 }, c2: { x: 150, y: 138 }, to: { x: 123, y: 164 } } },
      { id: 'en-to-set-and', sourceSignal: 'EN', curve: { from: { x: 240, y: 76 }, c1: { x: 240, y: 112 }, c2: { x: 220, y: 140 }, to: { x: 217, y: 164 } } },
      { id: 'not-to-reset-and', sourceSignal: 'notD', curve: { from: { x: 80, y: 144 }, c1: { x: 82, y: 152 }, c2: { x: 94, y: 158 }, to: { x: 103, y: 164 } } },
      { id: 'reset-and-to-sr', sourceSignal: 'dReset', curve: { from: { x: 103, y: 226 }, c1: { x: 103, y: 240 }, c2: { x: 114, y: 250 }, to: { x: 120, y: 260 } } },
      { id: 'set-and-to-sr', sourceSignal: 'dSet', curve: { from: { x: 217, y: 226 }, c1: { x: 217, y: 240 }, c2: { x: 204, y: 250 }, to: { x: 200, y: 260 } } },
      { id: 'sr-to-d-q', sourceSignal: 'dQ', curve: { from: { x: 160, y: 338 }, c1: { x: 160, y: 352 }, c2: { x: 161, y: 364 }, to: { x: 161, y: 376 } } }
    ];
  }
  if (gate.type === 'd-flipflop') {
    return [
      { id: 'ff-d-to-master', sourceSignal: 'D', points: [{ x: 72, y: 82 }, { x: 72, y: 128 }, { x: 138, y: 128 }, { x: 138, y: 164 }] },
      { id: 'ff-clk-to-not', sourceSignal: 'CLK', points: [{ x: 308, y: 82 }, { x: 308, y: 98 }, { x: 242, y: 98 }, { x: 242, y: 106 }] },
      { id: 'ff-not-to-master-clk', sourceSignal: 'ffNotCLK', points: [{ x: 242, y: 136 }, { x: 242, y: 164 }] },
      { id: 'ff-clk-to-slave-clk', sourceSignal: 'CLK', points: [{ x: 308, y: 82 }, { x: 308, y: 316 }, { x: 242, y: 316 }, { x: 242, y: 348 }] },
      { id: 'ff-master-to-slave', sourceSignal: 'ffMasterQ', points: [{ x: 190, y: 264 }, { x: 190, y: 304 }, { x: 138, y: 304 }, { x: 138, y: 348 }] },
      { id: 'ff-slave-to-q', sourceSignal: 'ffQ', points: [{ x: 190, y: 448 }, { x: 190, y: 508 }] }
    ];
  }
  if (gate.type === 'counter') {
    return [
      { id: 'counter-q3-to-not3', sourceSignal: 'Q3', points: [{ x: 160, y: 184 }, { x: 82, y: 184 }, { x: 82, y: 132 }] },
      { id: 'counter-notq3-to-d3', sourceSignal: 'notQ3', points: [{ x: 82, y: 104 }, { x: 82, y: 86 }, { x: 142, y: 86 }, { x: 142, y: 100 }] },
      { id: 'counter-q3-to-d2-clk', sourceSignal: 'Q3', points: [{ x: 160, y: 184 }, { x: 178, y: 184 }, { x: 178, y: 260 }] },
      { id: 'counter-q2-to-not2', sourceSignal: 'Q2', points: [{ x: 160, y: 344 }, { x: 82, y: 344 }, { x: 82, y: 292 }] },
      { id: 'counter-notq2-to-d2', sourceSignal: 'notQ2', points: [{ x: 82, y: 264 }, { x: 82, y: 246 }, { x: 142, y: 246 }, { x: 142, y: 260 }] },
      { id: 'counter-q2-to-d1-clk', sourceSignal: 'Q2', points: [{ x: 160, y: 344 }, { x: 178, y: 344 }, { x: 178, y: 420 }] },
      { id: 'counter-q1-to-not1', sourceSignal: 'Q1', points: [{ x: 160, y: 504 }, { x: 82, y: 504 }, { x: 82, y: 452 }] },
      { id: 'counter-notq1-to-d1', sourceSignal: 'notQ1', points: [{ x: 82, y: 424 }, { x: 82, y: 406 }, { x: 142, y: 406 }, { x: 142, y: 420 }] }
    ];
  }
  return [];
}

function signalWires() {
  const externalWires = activeCircuit.gate.type === 'd-flipflop'
    ? activeCircuit.wires.map((wire) => {
        const { from, to } = wireEndpoints(wire);
        return { ...wire, points: [from, to] };
      })
    : activeCircuit.wires;
  return [...externalWires, ...internalFeedbackWires(), ...internalCircuitWires()];
}

function currentGateInput(inputId) {
  return gateState.inputs[inputId]?.value ? 1 : 0;
}

function internalWireEndValue(wireId) {
  const nodes = wireNodeValues.get(wireId);
  if (!nodes) return 0;
  return nodes[WIRE_NODE_COUNT - 1] ? 1 : 0;
}

function signalValue(signal) {
  if (signal in (gateState.inputs ?? {})) return gateState.inputs[signal].value ? 1 : 0;
  if (activeCircuit.gate.type === 'counter' && ['Q3', 'Q2', 'Q1'].includes(signal)) {
    const branchByOutput = {
      Q3: 'CLK-box',
      Q2: 'counter-q3-to-d2-clk',
      Q1: 'counter-q2-to-d1-clk'
    };
    if (internalWireEndValue(branchByOutput[signal])) return evaluation.memory?.[signal] ? 1 : 0;
    return gateState.memory?.[signal] ? 1 : 0;
  }
  if (activeCircuit.gate.type === 'counter' && signal === 'notQ3') return signalValue('Q3') ? 0 : 1;
  if (activeCircuit.gate.type === 'counter' && signal === 'notQ2') return signalValue('Q2') ? 0 : 1;
  if (activeCircuit.gate.type === 'counter' && signal === 'notQ1') return signalValue('Q1') ? 0 : 1;
  if (signal in (evaluation.outputs ?? {})) return evaluation.outputs[signal] ? 1 : 0;
  if (signal === 'notD') return internalWireEndValue('d-in-to-not') ? 0 : 1;
  if (signal === 'dSet') return internalWireEndValue('d-in-to-set-and') && internalWireEndValue('en-to-set-and') ? 1 : 0;
  if (signal === 'dReset') return internalWireEndValue('not-to-reset-and') && internalWireEndValue('en-to-reset-and') ? 1 : 0;
  if (signal === 'dQ') {
    if (internalWireEndValue('set-and-to-sr')) return 1;
    if (internalWireEndValue('reset-and-to-sr')) return 0;
    return visibleEvaluation.outputs.Q ? 1 : 0;
  }
  if (signal === 'ffNotCLK') return internalWireEndValue('ff-clk-to-not') ? 0 : 1;
  if (signal === 'ffMasterQ') return visualLatchMemory.master ? 1 : 0;
  if (signal === 'ffQ') return visualLatchMemory.slave ? 1 : 0;
  return 0;
}

function wireSourceValue(wire) {
  if (wire.sourceSignal) return signalValue(wire.sourceSignal);
  if (activeCircuit.gate.type === 'd-latch' && wire.outputId === 'Q') return internalWireEndValue('sr-to-d-q');
  if (activeCircuit.gate.type === 'd-flipflop' && wire.outputId === 'Q') return internalWireEndValue('ff-slave-to-q');
  const fromInput = state.inputs[wire.from];
  if (fromInput) return fromInput.value ? 1 : 0;
  if (wire.outputId) return evaluation.outputs[wire.outputId] ? 1 : 0;
  return 0;
}

function initialWireNodeValues() {
  return new Map(signalWires().map((wire) => [
    wire.id,
    Array.from({ length: WIRE_NODE_COUNT }, () => wireSourceValue(wire))
  ]));
}

function wireNodesFor(wire) {
  return wireNodeValues.get(wire.id) ?? Array.from({ length: WIRE_NODE_COUNT }, () => 0);
}

function wireEndValue(wire) {
  return wireNodesFor(wire)[WIRE_NODE_COUNT - 1] ?? 0;
}

function inputWireFor(inputId) {
  return activeCircuit.wires.find((wire) => wire.from === inputId && wire.to === 'gate');
}

function outputWireFor(outputId) {
  return activeCircuit.wires.find((wire) => wire.outputId === outputId);
}

function syncGateInputsFromWireEnds() {
  let changed = false;
  const nextInputs = { ...gateState.inputs };
  for (const input of activeCircuit.inputs) {
    const wire = inputWireFor(input.id);
    const value = wire ? wireEndValue(wire) : 0;
    if ((nextInputs[input.id]?.value ?? 0) !== value) {
      nextInputs[input.id] = { mode: value ? INPUT_MODES.ONE : INPUT_MODES.ZERO, value };
      changed = true;
    }
  }
  if (!changed) return false;

  gateState = { ...gateState, inputs: nextInputs };
  evaluation = evaluateCircuit(activeCircuit, gateState, 'arrival');
  gateState = commitEvaluation(gateState, evaluation);
  state = { ...state, memory: gateState.memory };
  return true;
}

function syncVisibleOutputsFromWireEnds() {
  let changed = false;
  const nextOutputs = { ...visibleEvaluation.outputs };
  for (const output of activeCircuit.outputs) {
    const wire = outputWireFor(output.id);
    const value = wire ? wireEndValue(wire) : 0;
    if ((nextOutputs[output.id] ?? 0) !== value) {
      nextOutputs[output.id] = value;
      changed = true;
    }
  }
  if (!changed) return false;
  visibleEvaluation = { ...visibleEvaluation, outputs: nextOutputs };
  return true;
}

function syncCircuitFromWireEnds() {
  const gateChanged = syncGateInputsFromWireEnds();
  const outputChanged = syncVisibleOutputsFromWireEnds();
  return gateChanged || outputChanged;
}

function syncVisualLatchMemoryFromWireEnds() {
  if (activeCircuit.gate.type !== 'd-flipflop') return false;

  const nextMemory = { ...visualLatchMemory };
  if (internalWireEndValue('ff-not-to-master-clk')) {
    nextMemory.master = internalWireEndValue('ff-d-to-master') ? 1 : 0;
  }
  if (internalWireEndValue('ff-clk-to-slave-clk')) {
    nextMemory.slave = internalWireEndValue('ff-master-to-slave') ? 1 : 0;
  }

  if (nextMemory.master === visualLatchMemory.master && nextMemory.slave === visualLatchMemory.slave) return false;
  visualLatchMemory = nextMemory;
  return true;
}

function advanceWireNodes() {
  let changed = false;
  const nextWireNodeValues = new Map();
  for (const wire of signalWires()) {
    const current = wireNodesFor(wire);
    const next = [wireSourceValue(wire), ...current.slice(0, WIRE_NODE_COUNT - 1)];
    nextWireNodeValues.set(wire.id, next);
    if (!changed && (next.length !== current.length || next.some((value, index) => value !== current[index]))) changed = true;
  }
  if (!changed) return false;

  wireNodeValues = nextWireNodeValues;
  syncVisualLatchMemoryFromWireEnds();
  syncCircuitFromWireEnds();
  return true;
}


function gateMarkup(gate) {
  if (gate.type === 'line') return '';
  const common = `class="gate-shape ${activeCircuit.accent}"`;
  const label = `<text x="${gate.x + gate.w / 2}" y="${gate.y + gate.h / 2 + 5}" text-anchor="middle" class="gate-label">${gate.label}</text>`;
  if (gate.type === 'not') {
    const notLabel = `<text x="${gate.x + gate.w / 2 - 16}" y="${gate.y + gate.h / 2 + 5}" text-anchor="middle" class="gate-label">${gate.label}</text>`;
    return `
      <polygon ${common} points="${gate.x},${gate.y + 8} ${gate.x},${gate.y + gate.h - 8} ${gate.x + gate.w - 20},${gate.y + gate.h / 2}" />
      <circle class="inverter-bubble" cx="${gate.x + gate.w - 10}" cy="${gate.y + gate.h / 2}" r="9" />
      ${notLabel}`;
  }
  if (gate.type === 'and') {
    return `
      <path ${common} d="${andShapePath(gate)}" />
      ${label}`;
  }
  if (gate.type === 'or' || gate.type === 'nor') {
    const bubble = gate.type === 'nor' ? `<circle class="inverter-bubble" cx="${gate.x + gate.w + 8}" cy="${gate.y + gate.h / 2}" r="8" />` : '';
    return `
      <path ${common} d="${orShapePath(gate)}" />
      ${bubble}${label}`;
  }
  if (gate.type === 'sr-latch') {
    const top = activeCircuit.internal.gates[0];
    const bottom = activeCircuit.internal.gates[1];
    const internalNor = (item) => `
      <path class="inner-gate nor-shape" d="${orShapePath(item)}" />
      <circle class="inner-bubble" cx="${item.x + item.w + 6}" cy="${item.y + item.h / 2}" r="5.5" />
      <text x="${item.x + item.w / 2 - 3}" y="${item.y + item.h / 2 + 4}" text-anchor="middle" class="inner-label">NOR</text>`;
    return `
      <text x="${gate.x + gate.w / 2}" y="${gate.y + 15}" text-anchor="middle" class="gate-sub">${evaluation.status || 'holding'}</text>
      ${internalNor(top)}
      ${internalNor(bottom)}`;
  }
  if (gate.type === 'd-latch') {
    const inverter = { x: 55, y: 104, w: 50, h: 40 };
    const setAnd = { x: 62, y: 164, w: 82, h: 62 };
    const resetAnd = { x: 176, y: 164, w: 82, h: 62 };
    const srBox = { x: 62, y: 260, w: 196, h: 78 };
    return `
      <text x="${gate.x + gate.w / 2}" y="${gate.y + 14}" text-anchor="middle" class="gate-sub">${evaluation.status || 'holding'}</text>
      <polygon class="inner-gate" points="${inverter.x},${inverter.y} ${inverter.x + inverter.w},${inverter.y} ${inverter.x + inverter.w / 2},${inverter.y + inverter.h - 8}" />
      <circle class="inner-bubble" cx="${inverter.x + inverter.w / 2}" cy="${inverter.y + inverter.h - 4}" r="5" />
      <path class="inner-gate" d="${downAndShapePath(setAnd)}" />
      <path class="inner-gate" d="${downAndShapePath(resetAnd)}" />
      <text x="${setAnd.x + setAnd.w / 2}" y="${setAnd.y + 35}" text-anchor="middle" class="gate-label">AND</text>
      <text x="${resetAnd.x + resetAnd.w / 2}" y="${resetAnd.y + 35}" text-anchor="middle" class="gate-label">AND</text>
      <rect class="inner-gate" x="${srBox.x}" y="${srBox.y}" width="${srBox.w}" height="${srBox.h}" rx="10" />
      <text x="${srBox.x + srBox.w / 2}" y="${srBox.y + 32}" text-anchor="middle" class="gate-label">SR LATCH</text>
      <text x="${srBox.x + 58}" y="${srBox.y + 58}" text-anchor="middle" class="inner-label">RESET</text>
      <text x="${srBox.x + srBox.w - 60}" y="${srBox.y + 58}" text-anchor="middle" class="inner-label">SET</text>
      <text x="${gate.x + gate.w / 2}" y="${gate.y + gate.h - 12}" text-anchor="middle" class="gate-sub">D + EN → SR latch</text>`;
  }
  if (gate.type === 'd-flipflop') {
    const inverter = { x: 224, y: 106, w: 36, h: 34 };
    const master = { x: 100, y: 164, w: 180, h: 100 };
    const slave = { x: 100, y: 348, w: 180, h: 100 };
    return `
      <polygon class="inner-gate" points="${inverter.x},${inverter.y} ${inverter.x + inverter.w},${inverter.y} ${inverter.x + inverter.w / 2},${inverter.y + inverter.h - 8}" />
      <circle class="inner-bubble" cx="${inverter.x + inverter.w / 2}" cy="${inverter.y + inverter.h - 4}" r="5" />
      <text x="${inverter.x + inverter.w / 2}" y="${inverter.y + 20}" text-anchor="middle" class="inner-label">NOT</text>
      <rect class="inner-gate" x="${master.x}" y="${master.y}" width="${master.w}" height="${master.h}" rx="10" />
      <rect class="inner-gate" x="${slave.x}" y="${slave.y}" width="${slave.w}" height="${slave.h}" rx="10" />
      <text x="${master.x + master.w / 2}" y="${master.y - 8}" text-anchor="middle" class="gate-sub">master</text>
      <text x="${slave.x + slave.w / 2}" y="${slave.y - 8}" text-anchor="middle" class="gate-sub">slave</text>
      <text x="${master.x + master.w / 2}" y="${master.y + 48}" text-anchor="middle" class="gate-label">D LATCH</text>
      <text x="${slave.x + slave.w / 2}" y="${slave.y + 48}" text-anchor="middle" class="gate-label">D LATCH</text>
      <text x="${master.x + 38}" y="${master.y + 20}" text-anchor="middle" class="inner-label">D</text>
      <text x="${master.x + master.w - 38}" y="${master.y + 20}" text-anchor="middle" class="inner-label">EN</text>
      <text x="${master.x + master.w / 2}" y="${master.y + master.h - 14}" text-anchor="middle" class="inner-label">Q</text>
      <text x="${slave.x + 38}" y="${slave.y + 20}" text-anchor="middle" class="inner-label">D</text>
      <text x="${slave.x + slave.w - 38}" y="${slave.y + 20}" text-anchor="middle" class="inner-label">EN</text>
      <text x="${slave.x + slave.w / 2}" y="${slave.y + slave.h - 14}" text-anchor="middle" class="inner-label">Q</text>
      <text x="${gate.x + gate.w / 2}" y="${gate.y + gate.h - 12}" text-anchor="middle" class="gate-sub">master-slave D latch</text>`;
  }
  if (gate.type === 'counter') {
    const blocks = [
      { name: 'D3', x: 126, y: 100, q: 'Q3' },
      { name: 'D2', x: 126, y: 260, q: 'Q2' },
      { name: 'D1', x: 126, y: 420, q: 'Q1' }
    ];
    const flipflop = (item) => `
      <rect class="inner-gate" x="${item.x}" y="${item.y}" width="68" height="84" rx="4" />
      <text x="${item.x + 16}" y="${item.y + 18}" text-anchor="middle" class="inner-label">D</text>
      <text x="${item.x + 34}" y="${item.y + 42}" text-anchor="middle" class="gate-label">${item.name}</text>
      <text x="${item.x + 34}" y="${item.y + 72}" text-anchor="middle" class="inner-label">${item.q}</text>`;
    const inverter = (y) => `
      <polygon class="inner-gate" points="70,${y + 28} 94,${y + 28} 82,${y + 4}" />
      <circle class="inner-bubble" cx="82" cy="${y}" r="4.5" />`;
    return `
      ${blocks.map(flipflop).join('')}
      ${inverter(104)}
      ${inverter(264)}
      ${inverter(424)}`;
  }
  return `
    <rect ${common} x="${gate.x}" y="${gate.y}" width="${gate.w}" height="${gate.h}" rx="18" />
    <text x="${gate.x + gate.w / 2}" y="${gate.y + 38}" text-anchor="middle" class="gate-label">${gate.label}</text>
    <text x="${gate.x + gate.w / 2}" y="${gate.y + gate.h - 24}" text-anchor="middle" class="gate-sub">${evaluation.status || activeCircuit.category}</text>`;
}

function renderSvg() {
  const viewWidth = {
    'd-flipflop': 380,
    counter: 320
  }[activeCircuit.id] ?? 320;
  const viewHeight = {
    'sr-latch': 174,
    'd-latch': 452,
    'd-flipflop': 584,
    counter: 560
  }[activeCircuit.id] ?? 154;
  const wires = signalWires().map((wire) => {
    const nodes = wireNodesFor(wire);
    const isOn = nodes.some(Boolean);
    const poweredRuns = [];
    for (let index = 0; index < nodes.length; index += 1) {
      if (!nodes[index]) continue;
      const startIndex = index;
      while (index + 1 < nodes.length && nodes[index + 1]) index += 1;
      poweredRuns.push([startIndex, index]);
    }
    const segments = poweredRuns.map(([startIndex, endIndex]) => {
      const start = Math.max(0, startIndex / WIRE_NODE_COUNT - 0.002);
      const end = Math.min(1, (endIndex + 1) / WIRE_NODE_COUNT + 0.002);
      const sampleCount = Math.max(6, ((endIndex - startIndex + 1) * 4) + 1);
      const centerPoints = Array.from({ length: sampleCount }, (_, sampleIndex) => {
        const t = start + ((end - start) * (sampleIndex / (sampleCount - 1)));
        return wirePointAt(wire, t);
      });
      const points = powerBandPoints(centerPoints);
      return `<polygon class="wire-power-band powered" data-wire="${wire.id}" data-node-start="${startIndex}" data-node-end="${endIndex}" points="${points}" />`;
    }).join('');
    return `
    <g class="wire-group ${isOn ? 'on' : ''}" data-pulse="${pulseKey}">
      <path class="wire-base ${wire.id.includes('feedback') ? 'feedback-wire' : ''}" pathLength="100" d="${wirePath(wire)}" />
      ${segments}
    </g>`;
  }).join('');
  const inputs = activeCircuit.inputs.map((input) => {
    const item = state.inputs[input.id];
    const mode = item.value;
    const aria = `${activeCircuit.name} input ${input.label}, current ${mode}.`;
    return `<g class="node input-node interactive ${item.value ? 'on' : ''}" data-input="${input.id}" role="button" tabindex="0" aria-label="${aria}">
      <circle cx="${input.x}" cy="${input.y}" r="17" />
      <text x="${input.x}" y="${input.y + 5}" text-anchor="middle">${mode}</text>
      <text x="${input.x}" y="${input.y - 24}" text-anchor="middle" class="node-label">${input.label}</text>
    </g>`;
  }).join('');
  const outputs = activeCircuit.outputs.map((output) => {
    const value = visibleEvaluation.outputs[output.id] ?? 0;
    return `<g class="node output-node ${value ? 'on' : ''}" data-output="${output.id}">
      <rect x="${output.x - 16}" y="${output.y - 16}" width="38" height="32" rx="12" />
      <text x="${output.x + 3}" y="${output.y + 5}" text-anchor="middle" data-output-value>${value}</text>
      <text x="${output.x + 3}" y="${output.y - 23}" text-anchor="middle" class="node-label">${output.label}</text>
    </g>`;
  }).join('');
  return `<section class="circuit-card" aria-label="${activeCircuit.name} circuit diagram">
    <div class="circuit-meta">
      <span>${activeCircuit.name}</span>
      <small>${activeCircuit.category === 'sequential' ? 'memory circuit' : 'logic gate'}</small>
    </div>
    <svg viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" aria-label="${activeCircuit.name} pre-drawn circuit diagram">
      <defs>
        <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      ${wires}
      ${gateMarkup(activeCircuit.gate)}
      ${inputs}
      ${outputs}
    </svg>
  </section>`;
}

function selectorMarkup() {
  return `<nav class="selector" aria-label="Circuit selector">
    ${circuitDefinitions.map((circuit) => `<button class="selector-pill ${circuit.id === activeCircuit.id ? 'selected' : ''}" data-circuit="${circuit.id}" aria-pressed="${circuit.id === activeCircuit.id}">
      <span>${circuit.name}</span><small>${circuit.category === 'sequential' ? 'memory' : 'gate'}</small>
    </button>`).join('')}
  </nav>`;
}

function combinationalRows() {
  const inputCount = activeCircuit.inputs.length;
  return Array.from({ length: 2 ** inputCount }, (_, rowIndex) => {
    const rowState = createCircuitState(activeCircuit);
    activeCircuit.inputs.forEach((input, inputIndex) => {
      const bitValue = (rowIndex >> (inputCount - inputIndex - 1)) & 1;
      rowState.inputs[input.id] = {
        mode: bitValue ? INPUT_MODES.ONE : INPUT_MODES.ZERO,
        value: bitValue
      };
    });
    const rowEvaluation = evaluateCircuit(activeCircuit, rowState);
    return [
      ...activeCircuit.inputs.map((input) => rowState.inputs[input.id].value),
      ...activeCircuit.outputs.map((output) => rowEvaluation.outputs[output.id] ?? 0)
    ];
  });
}

function truthTableMarkup() {
  const headers = [
    ...activeCircuit.inputs.map((input) => input.label),
    ...activeCircuit.outputs.map((output) => output.label)
  ];
  let rows = combinationalRows();
  if (activeCircuit.id === 'sr-latch') {
    rows = [
      ['0', '0', '유지', '유지'],
      ['1', '0', '0', '1'],
      ['0', '1', '1', '0'],
      ['1', '1', '0 (사용 안함)', '0 (사용 안함)']
    ];
  }
  if (activeCircuit.id === 'd-latch') {
    rows = [
      ['0', '0', '유지'],
      ['1', '0', '유지'],
      ['0', '1', '0'],
      ['1', '1', '1']
    ];
  }
  if (activeCircuit.id === 'd-flipflop') {
    rows = [
      ['0', '0', 'master=0 / Q 유지'],
      ['1', '0', 'master=1 / Q 유지'],
      ['0', '↑', '이전 master'],
      ['1', '↑', '이전 master']
    ];
  }
  if (activeCircuit.id === 'counter') {
    rows = [
      ['시작', '0', '0', '0'],
      ['↑', '1', '1', '1'],
      ['↑', '0', '1', '1'],
      ['↑', '1', '0', '1'],
      ['↑', '0', '0', '1'],
      ['↑', '1', '1', '0'],
      ['↑', '0', '1', '0'],
      ['↑', '1', '0', '0'],
      ['↑', '0', '0', '0']
    ];
  }

  return `<div class="truth-table-wrap" aria-label="${activeCircuit.name} output table">
    <table class="truth-table">
      <thead>
        <tr>${headers.map((header) => `<th scope="col">${header}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function microcopyMarkup() {
  const copy = activeCircuit.microcopy;
  return `<section class="microcopy">
    <p class="eyebrow">오늘의 회로</p>
    <h3>${copy.purpose}</h3>
    <p>${copy.hint}</p>
    ${truthTableMarkup()}
  </section>`;
}

function render() {
  syncCircuitFromWireEnds();
  app.className = `app-shell theme-${activeCircuit.accent}`;
  app.innerHTML = `
    ${selectorMarkup()}
    ${renderSvg()}
    ${microcopyMarkup()}
  `;
}

wireNodeValues = initialWireNodeValues();
render();
