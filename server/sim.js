// Loads the shared simulation (src/10, 20, 30) into an isolated VM context per match.
// The browser runs the exact same files offline, so server and client rules never drift apart.
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const FILES = ['10-data.js', '20-sim-core.js', '30-sim-update.js'];
const SCRIPTS = FILES.map(f => new vm.Script('"use strict";\n' + fs.readFileSync(path.join(SRC, f), 'utf8'), { filename: f }));

function createSim() {
  const ctx = vm.createContext({ console });
  for (const s of SCRIPTS) s.runInContext(ctx);
  return ctx;
}

module.exports = { createSim };
