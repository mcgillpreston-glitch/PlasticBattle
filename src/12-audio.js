/* Browser only. */
/* ---------------- Audio ---------------- */
var AC = null, AMaster = null, noiseB = null, sfxLast = {};
function audioInit() {
  if (AC) return;
  var Ctor = window.AudioContext || window.webkitAudioContext; if (!Ctor) return;
  try {
    AC = new Ctor(); AMaster = AC.createGain(); AMaster.gain.value = opts.volume == null ? 0.55 : opts.volume; AMaster.connect(AC.destination);
    var n = AC.sampleRate; noiseB = AC.createBuffer(1, n, AC.sampleRate); var d = noiseB.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
var SFX_GAP = { splash: .08, kill: .2, alert: .5, rifle: .04, mg: .035, hit: .05, boom: .1, flame: .09, melee: .06, cast: .05, cannon: .12, rocket: .12, ui: .05, shell: .12 };
var sfxVoices = 0;
/* Every shot is built from three layers: a sharp transient (the crack), a tonal body (the report, pitched per weapon) and a noise tail (the room),
   then run through a distance low-pass so far-off fire sounds muffled and close fire sounds crisp. */
function playSfx(kind, x, y) {
  if (!AC || !opts.sound || !G) return;
  if (AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
  var t = AC.currentTime, last = sfxLast[kind] || 0;
  if (t - last < (SFX_GAP[kind] || .05)) return;
  sfxLast[kind] = t;
  var dist = x != null ? vlen(x - cam.x, y - cam.y) : 0, g = x != null ? clamp(1 - dist / 1900, 0, 1) : 1;
  if (g <= 0.02 || sfxVoices > 24) return;
  var near = clamp(1 - dist / 900, 0, 1), vary = 0.92 + Math.random() * 0.16;
  var out = AC.createGain(); out.gain.value = g * g * 0.9 + g * 0.1;
  var lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900 + near * 9000; lp.Q.value = 0.5;
  var pan = AC.createStereoPanner ? AC.createStereoPanner() : null;
  if (pan && x != null) pan.pan.value = clamp((x - cam.x) / 1100, -0.8, 0.8);
  out.connect(lp); if (pan) { lp.connect(pan); pan.connect(AMaster); } else lp.connect(AMaster);
  sfxVoices++; setTimeout(function () { sfxVoices--; }, 1200);
  function noise(dur, type, freq, q, vol, decay, delay) {
    var t0 = t + (delay || 0), src = AC.createBufferSource(); src.buffer = noiseB; src.loop = true; src.loopStart = Math.random() * 0.5;
    var f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq * vary; f.Q.value = q || 1;
    var e = AC.createGain(); e.gain.setValueAtTime(0.001, t0); e.gain.linearRampToValueAtTime(Math.max(0.001, vol), t0 + 0.004); e.gain.exponentialRampToValueAtTime(0.001, t0 + decay);
    src.connect(f); f.connect(e); e.connect(out); src.start(t0); src.stop(t0 + Math.max(dur, decay) + 0.02);
  }
  function tone(type, f0, f1, dur, vol, delay) {
    var t0 = t + (delay || 0), o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0 * vary, t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1 * vary), t0 + dur);
    var e = AC.createGain(); e.gain.setValueAtTime(0.001, t0); e.gain.linearRampToValueAtTime(Math.max(0.001, vol), t0 + 0.003); e.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(e); e.connect(out); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  /* crack: a few ms of bright noise, the supersonic snap of a round */
  function crack(vol) { noise(0.02, 'highpass', 3500, 0.7, vol, 0.02); }
  /* report: the low thump of the muzzle blast */
  function report(f, vol, dur) { tone('sine', f, f * 0.35, dur, vol); noise(dur, 'lowpass', 420, 0.8, vol * 0.8, dur); }
  switch (kind) {
    case 'rifle': crack(0.9); report(170, 0.55, 0.12); noise(0.2, 'bandpass', 1400, 0.6, 0.5, 0.17, 0.004); noise(0.4, 'lowpass', 2500, 0.5, 0.18 * near, 0.4, 0.03); break;
    case 'mg': crack(0.7); report(220, 0.35, 0.07); noise(0.1, 'bandpass', 1900, 0.8, 0.45, 0.08, 0.003); break;
    case 'cannon': crack(0.6); tone('sine', 60, 28, 0.55, 0.9); noise(0.6, 'lowpass', 260, 0.7, 1.0, 0.55); noise(0.3, 'bandpass', 900, 0.5, 0.5, 0.25, 0.01); noise(1.0, 'lowpass', 1200, 0.4, 0.25 * near, 0.9, 0.08); break;
    case 'boom': tone('sine', 55, 22, 0.7, 1.0); noise(0.8, 'lowpass', 220, 0.7, 1.0, 0.7); noise(0.35, 'bandpass', 700, 0.6, 0.6, 0.3, 0.01); noise(1.4, 'lowpass', 1500, 0.4, 0.3 * near, 1.3, 0.1); break;
    case 'shell': tone('sine', 1400, 300, 0.7, 0.07); noise(0.7, 'bandpass', 2200, 2, 0.08, 0.7); break;
    case 'rocket': noise(0.1, 'bandpass', 1200, 0.5, 0.5, 0.1); noise(0.5, 'lowpass', 1600, 0.4, 0.45, 0.45, 0.02); tone('sawtooth', 320, 90, 0.4, 0.12, 0.02); break;
    case 'flame': noise(0.3, 'lowpass', 900, 0.6, 0.35, 0.28); noise(0.25, 'bandpass', 2400, 0.4, 0.15, 0.22); tone('sine', 90, 70, 0.25, 0.12); break;
    case 'melee': noise(0.06, 'bandpass', 2800, 1.5, 0.35, 0.05); noise(0.12, 'bandpass', 500, 1, 0.45, 0.1, 0.008); tone('triangle', 180, 90, 0.08, 0.25); break;
    case 'hit': noise(0.05, 'bandpass', 1100, 1.2, 0.35, 0.05); tone('square', 520, 260, 0.04, 0.1); break;
    case 'cast': tone('sine', 420, 840, 0.09, 0.2); noise(0.08, 'highpass', 4000, 0.5, 0.1, 0.07); break;
    case 'ui': tone('sine', 600, 600, 0.05, 0.15); break;
    case 'splash': noise(0.3, 'highpass', 2500, 0.5, 0.3, 0.25); noise(0.2, 'bandpass', 700, 0.8, 0.2, 0.18); break;
    case 'kill': tone('square', 880, 440, 0.07, 0.18); tone('sine', 1320, 660, 0.12, 0.12); break;
    case 'alert': tone('square', 520, 520, 0.08, 0.14); tone('square', 390, 390, 0.1, 0.14); break;
  }
}
