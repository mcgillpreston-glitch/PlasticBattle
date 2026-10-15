// Loads the shared simulation (src/10, 20, 30) into an isolated VM context per match.
// The browser runs the exact same files offline, so server and client rules never drift apart.
// The files are wrapped in one closure (as build.js does for the browser) so the sim's variables are
// fast locals rather than slow context globals; every top-level function and variable is exported
// through an API object, with live getters for the variables (G is replaced on each new game).
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const FILES = ['10-data.js', '20-sim-core.js', '30-sim-update.js'];
const body = FILES.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
const names = new Set();
for (const m of body.matchAll(/^function\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
for (const m of body.matchAll(/^var\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
const api = [...names].map(n => `get ${n}() { return ${n}; }, set ${n}(v) { ${n} = v; }`).join(',\n');
const SCRIPT = new vm.Script('(function () { "use strict";\n' + body + '\nreturn {\n' + api + '\n};\n})()', { filename: 'sim.js' });

function createSim() {
  const ctx = vm.createContext({ console });
  return SCRIPT.runInContext(ctx);
}

module.exports = { createSim };
