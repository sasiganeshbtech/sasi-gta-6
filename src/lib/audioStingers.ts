let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playClipSavedChime(muted: boolean): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [587.33, 880, 1174.66]; // D5 -> A5 -> D6 crisp studio chime
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + idx * 0.055);
    gain.gain.setValueAtTime(0.0001, now + idx * 0.055);
    gain.gain.exponentialRampToValueAtTime(0.09, now + idx * 0.055 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.055 + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + idx * 0.055);
    osc.stop(now + idx * 0.055 + 0.25);
  });
}

export function playStingerAudio(
  stinger: 'MISSION PASSED' | 'RESPECT +' | 'WASTED' | 'BUSTED' | 'wanted',
  muted: boolean
): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  if (stinger === 'WASTED' || stinger === 'BUSTED') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.65);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.72);
    return;
  }

  if (stinger === 'wanted') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.setValueAtTime(880, now + 0.09);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
    return;
  }

  // MISSION PASSED / RESPECT + warm major 9th swell
  const chord = [261.63, 329.63, 392.0, 493.88, 587.33];
  chord.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + i * 0.04);
    gain.gain.setValueAtTime(0.0001, now + i * 0.04);
    gain.gain.exponentialRampToValueAtTime(0.05, now + i * 0.04 + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.04);
    osc.stop(now + 1.0);
  });
}
