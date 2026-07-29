export type SoundCue =
  | "tap"
  | "start"
  | "correct"
  | "wrong"
  | "skip"
  | "countdown"
  | "winner";

type Note = [frequency: number, offset: number, duration: number, gain: number];

const cues: Record<SoundCue, Note[]> = {
  tap: [[360, 0, 0.045, 0.08]],
  start: [
    [330, 0, 0.1, 0.12],
    [494, 0.08, 0.14, 0.13],
  ],
  correct: [
    [523, 0, 0.1, 0.13],
    [659, 0.08, 0.1, 0.12],
    [784, 0.16, 0.16, 0.14],
  ],
  wrong: [
    [220, 0, 0.12, 0.12],
    [165, 0.1, 0.18, 0.11],
  ],
  skip: [
    [420, 0, 0.06, 0.09],
    [315, 0.05, 0.09, 0.08],
  ],
  countdown: [[880, 0, 0.06, 0.08]],
  winner: [
    [392, 0, 0.12, 0.13],
    [523, 0.1, 0.12, 0.13],
    [659, 0.2, 0.14, 0.14],
    [784, 0.34, 0.28, 0.16],
  ],
};

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.7;
  private muted = false;

  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.applyGain();
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume));
    this.applyGain();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyGain();
  }

  private applyGain() {
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(
      this.muted ? 0 : this.volume,
      this.context.currentTime,
      0.015,
    );
  }

  async play(cue: SoundCue) {
    if (this.muted) return;
    await this.unlock();
    if (!this.context || !this.master) return;

    const now = this.context.currentTime;
    for (const [frequency, offset, duration, gain] of cues[cue]) {
      const oscillator = this.context.createOscillator();
      const envelope = this.context.createGain();
      oscillator.type = cue === "wrong" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      envelope.gain.setValueAtTime(0.0001, now + offset);
      envelope.gain.exponentialRampToValueAtTime(gain, now + offset + 0.012);
      envelope.gain.exponentialRampToValueAtTime(
        0.0001,
        now + offset + duration,
      );
      oscillator.connect(envelope);
      envelope.connect(this.master);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + duration + 0.02);
    }
  }
}
