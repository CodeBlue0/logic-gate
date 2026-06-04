export const INPUT_MODES = Object.freeze({ ZERO: '0', ONE: '1' });

const bit = (value) => (value ? 1 : 0);
const valuesFor = (inputs) => Object.fromEntries(inputs.map((input) => [input.id, input.value]));
const initialMemoryFor = (circuit) => circuit.initialMemory ? structuredClone(circuit.initialMemory) : {};

export function nextInputMode(mode) {
  if (mode === INPUT_MODES.ZERO) return INPUT_MODES.ONE;
  return INPUT_MODES.ZERO;
}

export function inputValueForMode(mode) {
  if (mode === INPUT_MODES.ONE) return 1;
  return 0;
}

function makeInput(id, label, x, y, hint = '') {
  return { id, label, x, y, hint };
}

function makeOutput(id, label, x, y) {
  return { id, label, x, y };
}

function wire(id, from, to, outputId = null) {
  return { id, from, to, outputId };
}

export const circuitDefinitions = [
  {
    id: 'line',
    name: 'Line',
    category: 'wire',
    accent: 'slate',
    inputs: [makeInput('A', 'A', 34, 80, '전선에 값을 넣어요.')],
    outputs: [makeOutput('Y', 'Y', 286, 80)],
    gate: { type: 'line', label: 'LINE', x: 122, y: 62, w: 86, h: 36 },
    wires: [{ id: 'A-Y', from: 'A', to: 'Y', outputId: 'Y' }],
    microcopy: {
      purpose: '전선은 입력을 그대로 출력으로 보내요.',
      hint: 'A를 누르면 전류가 선을 따라 Y까지 이동합니다.',
      output: 'A가 0이면 Y도 0, A가 1이면 Y도 1입니다.'
    },
    evaluate: ({ A }) => ({ outputs: { Y: bit(A) } })
  },
  {
    id: 'not',
    name: 'NOT',
    category: 'combinational',
    accent: 'violet',
    inputs: [makeInput('A', 'A', 34, 80, '한 입력을 뒤집어요.')],
    outputs: [makeOutput('Y', 'Y', 284, 80)],
    gate: { type: 'not', label: 'NOT', x: 122, y: 45, w: 86, h: 70 },
    wires: [wire('A-gate', 'A', 'gate'), wire('gate-Y', 'gate', 'Y', 'Y')],
    microcopy: {
      purpose: 'NOT 게이트는 입력을 반대로 바꾸는 작은 뒤집개예요.',
      hint: '입력 A의 반대가 출력 Y에 나타납니다.',
      output: 'A가 0이면 Y는 1, A가 1이면 Y는 0입니다.'
    },
    evaluate: ({ A }) => ({ outputs: { Y: bit(!A) } })
  },
  {
    id: 'and',
    name: 'AND',
    category: 'combinational',
    accent: 'blue',
    inputs: [makeInput('A', 'A', 32, 52), makeInput('B', 'B', 32, 110)],
    outputs: [makeOutput('Y', 'Y', 286, 82)],
    gate: { type: 'and', label: 'AND', x: 120, y: 42, w: 92, h: 80 },
    wires: [wire('A-gate', 'A', 'gate'), wire('B-gate', 'B', 'gate'), wire('gate-Y', 'gate', 'Y', 'Y')],
    microcopy: {
      purpose: 'AND는 “둘 다 켜져야 켜짐”을 보여줘요.',
      hint: 'A와 B를 모두 1로 만들면 출력이 켜집니다.',
      output: 'A와 B가 모두 1일 때만 Y가 1입니다.'
    },
    evaluate: ({ A, B }) => ({ outputs: { Y: bit(A && B) } })
  },
  {
    id: 'or',
    name: 'OR',
    category: 'combinational',
    accent: 'cyan',
    inputs: [makeInput('A', 'A', 32, 52), makeInput('B', 'B', 32, 110)],
    outputs: [makeOutput('Y', 'Y', 286, 82)],
    gate: { type: 'or', label: 'OR', x: 116, y: 42, w: 96, h: 80 },
    wires: [wire('A-gate', 'A', 'gate'), wire('B-gate', 'B', 'gate'), wire('gate-Y', 'gate', 'Y', 'Y')],
    microcopy: {
      purpose: 'OR는 “하나라도 켜지면 켜짐”을 보여줘요.',
      hint: 'A 또는 B 중 하나만 1이어도 출력이 켜집니다.',
      output: '둘 중 하나 이상이 1이면 Y가 1입니다.'
    },
    evaluate: ({ A, B }) => ({ outputs: { Y: bit(A || B) } })
  },
  {
    id: 'nor',
    name: 'NOR',
    category: 'combinational',
    accent: 'orange',
    inputs: [makeInput('A', 'A', 32, 52), makeInput('B', 'B', 32, 110)],
    outputs: [makeOutput('Y', 'Y', 286, 82)],
    gate: { type: 'nor', label: 'NOR', x: 116, y: 42, w: 96, h: 80 },
    wires: [wire('A-gate', 'A', 'gate'), wire('B-gate', 'B', 'gate'), wire('gate-Y', 'gate', 'Y', 'Y')],
    microcopy: {
      purpose: 'NOR는 OR 결과를 마지막에 뒤집어요.',
      hint: 'A와 B가 모두 0일 때만 출력이 켜지는 걸 찾아보세요.',
      output: 'A와 B 중 하나라도 1이면 Y는 0, 둘 다 0일 때만 1입니다.'
    },
    evaluate: ({ A, B }) => ({ outputs: { Y: bit(!(A || B)) } })
  },
  {
    id: 'sr-latch',
    name: 'SR latch',
    category: 'sequential',
    accent: 'indigo',
    initialMemory: { Q: 0, NQ: 1 },
    inputs: [makeInput('S', 'SET', 28, 58, 'Set'), makeInput('R', 'RESET', 28, 118, 'Reset')],
    outputs: [makeOutput('NQ', 'Q̅', 288, 58), makeOutput('Q', 'Q', 288, 118)],
    gate: { type: 'sr-latch', label: 'SR LATCH', x: 102, y: 28, w: 132, h: 118 },
    wires: [
      wire('S-top', 'S', 'gate'), wire('R-bottom', 'R', 'gate'),
      wire('top-NQ', 'gate', 'NQ', 'NQ'), wire('bottom-Q', 'gate', 'Q', 'Q')
    ],
    internal: {
      gates: [
        { id: 'norTop', label: 'NOR', x: 126, y: 44, w: 72, h: 34 },
        { id: 'norBottom', label: 'NOR', x: 126, y: 106, w: 72, h: 34 }
      ],
      feedback: true
    },
    microcopy: {
      purpose: 'SR latch는 두 개의 NOR 게이트가 서로 되먹임되어 1비트를 기억해요.',
      hint: 'S는 Q를 1로 set, R은 Q를 0으로 reset합니다. S=0, R=0이면 이전 상태를 유지해요.',
      output: 'S=1/R=0 → set, S=0/R=1 → reset, S=0/R=0 → hold. S=1/R=1은 수업용 금지 상태로 표시합니다.'
    },
    evaluate: ({ S, R }, memory) => {
      let Q = bit(memory.Q);
      let NQ = bit(memory.NQ);
      for (let step = 0; step < 4; step += 1) {
        const nextQ = bit(!(R || NQ));
        const nextNQ = bit(!(S || Q));
        if (nextQ === Q && nextNQ === NQ) break;
        Q = nextQ;
        NQ = nextNQ;
      }
      const outputs = { Q, NQ };
      if (S && R) return { outputs, memory: { ...memory }, status: 'invalid' };
      if (S) return { outputs, memory: outputs, status: 'set' };
      if (R) return { outputs, memory: outputs, status: 'reset' };
      return { outputs, memory: outputs, status: 'holding' };
    }
  },
  {
    id: 'd-latch',
    name: 'D latch',
    category: 'sequential',
    accent: 'green',
    initialMemory: { Q: 0 },
    inputs: [makeInput('D', 'D', 80, 38, '저장할 값'), makeInput('EN', 'ENABLE', 240, 38, '문 열기')],
    outputs: [makeOutput('Q', 'Q', 158, 414)],
    gate: { type: 'd-latch', label: 'D LATCH', x: 24, y: 76, w: 272, h: 300 },
    wires: [wire('D-box', 'D', 'gate'), wire('EN-box', 'EN', 'gate'), wire('box-Q', 'gate', 'Q', 'Q')],
    microcopy: {
      purpose: 'D latch는 문이 열려 있을 때 값을 따라가고, 닫히면 기억해요.',
      hint: 'EN을 1로 만들면 Q가 D를 따라갑니다. EN이 0이면 Q는 유지됩니다.',
      output: '열림: 따라감 / 닫힘: 마지막 Q를 기억합니다.'
    },
    evaluate: ({ D, EN }, memory) => {
      const nextQ = EN ? bit(D) : bit(memory.Q);
      return { outputs: { Q: nextQ }, memory: { Q: nextQ }, status: EN ? 'transparent' : 'holding' };
    }
  },
  {
    id: 'd-flipflop',
    name: 'D flipflop',
    category: 'sequential',
    accent: 'teal',
    initialMemory: { master: 0, Q: 0 },
    inputs: [makeInput('D', 'D', 72, 38, '저장할 값'), makeInput('CLK', 'CLK', 308, 38, '클럭')],
    outputs: [makeOutput('Q', 'Q', 190, 546)],
    gate: { type: 'd-flipflop', label: 'D FLIPFLOP', x: 32, y: 82, w: 316, h: 426 },
    wires: [wire('D-box', 'D', 'gate'), wire('CLK-box', 'CLK', 'gate'), wire('box-Q', 'gate', 'Q', 'Q')],
    microcopy: {
      purpose: 'CLK를 켜면 D 값이 Q로 옮겨져요.',
      hint: 'D를 먼저 정하고 CLK를 1로 바꾸면, 그 값이 출력 Q에 나타나요.',
      output: 'CLK=0일 때 master가 D를 따라가고, CLK=1일 때 slave가 master 값을 Q로 내보냅니다.'
    },
    evaluate: ({ D, CLK }, memory) => {
      const currentMaster = bit(memory.master);
      const currentQ = bit(memory.Q);
      if (CLK) {
        return {
          outputs: { Q: currentMaster },
          memory: { master: currentMaster, Q: currentMaster },
          status: 'slave'
        };
      }
      const nextMaster = bit(D);
      return {
        outputs: { Q: currentQ },
        memory: { master: nextMaster, Q: currentQ },
        status: 'master'
      };
    }
  },
  {
    id: 'counter',
    name: 'Counter',
    category: 'sequential',
    accent: 'pink',
    initialMemory: { Q3: 1, Q2: 1, Q1: 1, prevCLK: 0 },
    inputs: [makeInput('CLK', 'CLK', 160, 38, '상승 에지')],
    outputs: [makeOutput('NQ1', 'NOT Q1', 42, 424), makeOutput('NQ2', 'NOT Q2', 42, 264), makeOutput('NQ3', 'NOT Q3', 42, 104)],
    gate: { type: 'counter', label: 'COUNTER', x: 72, y: 76, w: 200, h: 448 },
    wires: [
      { id: 'CLK-box', from: 'CLK', to: 'gate', points: [{ x: 160, y: 56 }, { x: 178, y: 56 }, { x: 178, y: 100 }] },
      { id: 'box-NQ3', from: 'gate', to: 'NQ3', outputId: 'NQ3', sourceSignal: 'notQ3', points: [{ x: 82, y: 104 }, { x: 64, y: 104 }] },
      { id: 'box-NQ2', from: 'gate', to: 'NQ2', outputId: 'NQ2', sourceSignal: 'notQ2', points: [{ x: 82, y: 264 }, { x: 64, y: 264 }] },
      { id: 'box-NQ1', from: 'gate', to: 'NQ1', outputId: 'NQ1', sourceSignal: 'notQ1', points: [{ x: 82, y: 424 }, { x: 64, y: 424 }] }
    ],
    microcopy: {
      purpose: 'CLK를 누를 때마다 불빛 위치가 한 칸씩 움직여요.',
      hint: '각 D flipflop은 자기 Q의 반대값을 D로 받고, 앞단 Q가 다음 CLK를 켭니다.',
      output: 'Q3가 D2의 CLK로, Q2가 D1의 CLK로 이어집니다.'
    },
    evaluate: ({ CLK }, memory) => {
      const prevCLK = bit(memory.prevCLK);
      const rising = CLK && !prevCLK;
      const current = {
        Q3: bit(memory.Q3),
        Q2: bit(memory.Q2),
        Q1: bit(memory.Q1)
      };
      const next = { ...current };
      if (rising) {
        next.Q3 = bit(!current.Q3);
        if (!current.Q3 && next.Q3) next.Q2 = bit(!current.Q2);
        if (!current.Q2 && next.Q2) next.Q1 = bit(!current.Q1);
      }
      return {
        outputs: { NQ3: bit(!next.Q3), NQ2: bit(!next.Q2), NQ1: bit(!next.Q1) },
        memory: { ...next, prevCLK: bit(CLK) },
        status: rising ? 'shift' : 'holding'
      };
    }
  }

];

export function createCircuitState(circuit) {
  return {
    circuitId: circuit.id,
    inputs: Object.fromEntries(circuit.inputs.map((input) => [input.id, { mode: INPUT_MODES.ZERO, value: 0 }])),
    memory: initialMemoryFor(circuit),
    tick: 0,
    lastChanged: null
  };
}

export function getCircuit(id) {
  const circuit = circuitDefinitions.find((item) => item.id === id);
  if (!circuit) throw new Error(`Unknown circuit: ${id}`);
  return circuit;
}

export function tapInput(state, inputId) {
  const current = state.inputs[inputId];
  if (!current) throw new Error(`Unknown input: ${inputId}`);
  const mode = nextInputMode(current.mode);
  return {
    ...state,
    inputs: {
      ...state.inputs,
      [inputId]: { mode, value: inputValueForMode(mode) }
    },
    lastChanged: inputId
  };
}

export function evaluateCircuit(circuit, state, reason = 'change') {
  const inputValues = valuesFor(Object.entries(state.inputs).map(([id, input]) => ({ id, value: input.value })));
  const result = circuit.evaluate(inputValues, state.memory, reason, state.tick) ?? {};
  return {
    outputs: result.outputs ?? {},
    memory: result.memory ?? state.memory,
    status: result.status ?? ''
  };
}

export function commitEvaluation(state, evaluation) {
  return { ...state, memory: evaluation.memory };
}
