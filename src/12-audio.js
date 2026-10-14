/* Browser only. */
/* ---------------- Audio ---------------- */
var AC = null, AMaster = null, noiseB = null, sfxLast = {};
function audioInit() {
  if (AC) return;
  var Ctor = window.AudioContext || window.webkitAudioContext; if (!Ctor) return;
  try {
    AC = new Ctor(); AMaster = AC.createGain(); AMaster.gain.value = 0.55; AMaster.connect(AC.destination);
    var n = AC.sampleRate; noiseB = AC.createBuffer(1, n, AC.sampleRate); var d = noiseB.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
var SFX_GAP = { rifle: .03, mg: .03, hit: .05, boom: .08, flame: .1, melee: .05, cast: .05, cannon: .08, rocket: .1, ui: .05, shell: .1 };
function playSfx(kind, x, y) {
  if (!AC || !opts.sound || !G) return;
  if (AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
  var t = AC.currentTime, last = sfxLast[kind] || 0;
  if (t - last < (SFX_GAP[kind] || .05)) return;
  sfxLast[kind] = t;
  var g = 1;
  if (x != null) { g = clamp(1 - vlen(x - cam.x, y - cam.y) / 1700, 0, 1); if (g <= 0.02) return; }
  var out = AC.createGain(); out.gain.value = 1; out.connect(AMaster);
  function noise(dur, type, freq, q, vol, decay) {
    var s = AC.createBufferSource(); s.buffer = noiseB; s.loop = true;
    var f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    var e = AC.createGain(); e.gain.setValueAtTime(Math.max(0.001, vol * g), t); e.gain.exponentialRampToValueAtTime(0.001, t + decay);
    s.connect(f); f.connect(e); e.connect(out); s.start(t); s.stop(t + dur);
  }
  function tone(type, f0, f1, dur, vol) {
    var o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    var e = AC.createGain(); e.gain.setValueAtTime(Math.max(0.001, vol * g), t); e.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(e); e.connect(out); o.start(t); o.stop(t + dur);
  }
  switch (kind) {
    case 'rifle': noise(0.12, 'bandpass', 1600, 0.6, 0.7, 0.1); tone('triangle', 180, 40, 0.08, 0.25); break;
    case 'mg': noise(0.07, 'bandpass', 2200, 0.8, 0.45, 0.06); break;
    case 'cannon': noise(0.4, 'lowpass', 500, 1, 0.9, 0.35); tone('sine', 90, 30, 0.3, 0.6); break;
    case 'boom': noise(0.6, 'lowpass', 320, 1, 1.0, 0.5); tone('sine', 70, 25, 0.45, 0.7); break;
    case 'shell': tone('sine', 900, 200, 0.5, 0.12); break;
    case 'rocket': noise(0.3, 'bandpass', 900, 0.5, 0.35, 0.3); break;
    case 'flame': noise(0.2, 'lowpass', 1200, 0.7, 0.25, 0.18); break;
    case 'melee': noise(0.08, 'bandpass', 600, 1, 0.4, 0.07); break;
    case 'hit': tone('square', 700, 300, 0.04, 0.16); break;
    case 'cast': tone('sine', 420, 840, 0.09, 0.2); break;
    case 'ui': tone('sine', 600, 600, 0.05, 0.15); break;
  }
}
