// Web Audio API によるアイドルポップ・シンセサイザー音源 & 効果音エンジン
class SynthPlayer {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.activeNodes = [];
    this.isPlaying = false;
    this.playTimeout = null;
    this.audioElement = null;
  }

  async init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime); // しっかり聴こえるマスター音量
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // 音名から周波数への変換マップ (A4 = 440Hz)
  getFrequency(note) {
    const noteMap = {
      'C4': 261.63, 'C#4': 277.18, 'Db4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'Eb4': 311.13,
      'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'Gb4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'Ab4': 415.30,
      'A4': 440.00, 'A#4': 466.16, 'Bb4': 466.16, 'B4': 493.88,
      'C5': 523.25, 'C#5': 554.37, 'Db5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'Eb5': 622.25,
      'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'Gb5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'Ab5': 830.61,
      'A5': 880.00, 'A#5': 932.33, 'Bb5': 932.33, 'B5': 987.77,
      'C6': 1046.50, 'C#6': 1108.73, 'D6': 1174.66, 'E6': 1318.51
    };
    return noteMap[note] || 440;
  }

  // イントロメロディの再生
  async playIntro(melody, bpm = 180, maxDuration = null, onEnd = null) {
    this.stop();
    await this.init();
    this.isPlaying = true;

    if (!melody || melody.length === 0) {
      console.warn('メロディデータが空です');
      return;
    }

    const tempoScale = 120 / bpm;
    let currentTime = this.ctx.currentTime + 0.08;
    const startTime = currentTime;

    melody.forEach((item) => {
      const noteFreq = this.getFrequency(item.note);
      const noteDuration = item.len * tempoScale;

      if (maxDuration && (currentTime - startTime + noteDuration > maxDuration)) {
        return;
      }

      this.scheduleNote(noteFreq, currentTime, noteDuration);
      currentTime += noteDuration;
    });

    const totalDuration = currentTime - startTime;
    this.playTimeout = setTimeout(() => {
      this.isPlaying = false;
      if (onEnd) onEnd();
    }, (maxDuration ? Math.min(totalDuration, maxDuration) : totalDuration) * 1000);
  }

  // はっきり聴こえる明るいアイドルシンセ音色
  scheduleNote(freq, time, duration) {
    if (!this.ctx || !this.masterGain) return;

    // オシレータ1: 矩形波（チップチューン）
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(freq, time);

    // オシレータ2: ノコギリ波（明るさと抜けの良さ）
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq * 1.002, time);

    // フィルター
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, time);
    filter.frequency.exponentialRampToValueAtTime(1200, time + duration);

    // ゲインエンベロープ
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, time);
    gainNode.gain.linearRampToValueAtTime(0.35, time + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration + 0.05);
    osc2.stop(time + duration + 0.05);

    this.activeNodes.push(osc1, osc2, gainNode, filter);
  }

  // テスト用サウンド（ピロリ〜ン♪）
  async playTestSound() {
    await this.init();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const now = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);
      gain.gain.setValueAtTime(0.3, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.3);
      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.35);
    });
  }

  stop() {
    this.isPlaying = false;
    if (this.playTimeout) {
      clearTimeout(this.playTimeout);
      this.playTimeout = null;
    }
    this.activeNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {}
    });
    this.activeNodes = [];
  }

  // 正解音（ピンポンピンポン！）
  playCorrectSound() {
    this.init();
    const now = this.ctx.currentTime;
    [659.25, 880.00].forEach((freq, i) => { // E5 -> A5
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.15);

      gain.gain.setValueAtTime(0.2, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.4);
    });
  }

  // 不正解音（ブブー）
  playIncorrectSound() {
    this.init();
    const now = this.ctx.currentTime;
    [185.00, 175.00].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.18);

      gain.gain.setValueAtTime(0.18, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.35);
    });
  }

  // クリック音
  playClickSound() {
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.05);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }
}

window.synthPlayer = new SynthPlayer();
