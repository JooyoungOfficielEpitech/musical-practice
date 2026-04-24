const createMockGainNode = () => ({
  gain: {
    value: 1,
    setValueAtTime: jest.fn(),
    linearRampToValueAtTime: jest.fn(),
  },
  connect: jest.fn(),
  disconnect: jest.fn(),
});

const createMockOscillatorNode = () => ({
  type: "sine" as OscillatorType,
  frequency: {
    value: 440,
    setValueAtTime: jest.fn(),
  },
  connect: jest.fn(),
  disconnect: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
});

const createMockBufferSourceNode = () => ({
  buffer: null as AudioBuffer | null,
  playbackRate: {
    value: 1,
    setValueAtTime: jest.fn(),
  },
  connect: jest.fn(),
  disconnect: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
});

export class AudioBuffer {
  readonly length: number;
  readonly duration: number;
  readonly sampleRate: number;
  readonly numberOfChannels: number;

  constructor(
    options: { length?: number; sampleRate?: number; numberOfChannels?: number } = {},
  ) {
    this.length = options.length ?? 44100;
    this.sampleRate = options.sampleRate ?? 44100;
    this.numberOfChannels = options.numberOfChannels ?? 1;
    this.duration = this.length / this.sampleRate;
  }
}

export class AudioContext {
  currentTime = 0;
  state: AudioContextState = "running";
  sampleRate = 44100;
  destination = {};

  createOscillator = jest.fn(() => createMockOscillatorNode());
  createGain = jest.fn(() => createMockGainNode());
  createBufferSource = jest.fn(() => createMockBufferSourceNode());

  decodeAudioData = jest.fn(async (_fileUri: string) => {
    return new AudioBuffer();
  });

  suspend = jest.fn(async () => {
    this.state = "suspended";
  });

  resume = jest.fn(async () => {
    this.state = "running";
  });

  close = jest.fn(async () => {
    this.state = "closed";
  });
}
