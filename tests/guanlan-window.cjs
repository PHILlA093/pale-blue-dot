// Isolated window-entry regression: no real windows, API calls or user profile access.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
function fn(source, name) {
  const start = source.indexOf('  function ' + name + '(');
  assert.ok(start >= 0, 'missing function ' + name);
  return source.slice(start, source.indexOf('\n  }', start) + 4);
}
function entry({ desktop = false, blocked = false, throws = false } = {}) {
  const handlers = [], notices = [], opened = [];
  const panel = { hidden: true };
  const button = { addEventListener(type, callback) { handlers.push(callback); } };
  const win = { open(url, name) {
    if (throws) throw new Error('window unavailable');
    opened.push({ url, name });
    return desktop || blocked ? null : {};
  } };
  if (desktop) win.chrome = { webview: { postMessage() {} } };
  const ctx = vm.createContext({ window: win,
    document: { getElementById: id => id === 'guanlanOpen' ? button : id === 'guanlan' ? panel : null },
    qgNotice: text => notices.push(text),
    openPanel: () => { panel.hidden = false; },
    on: (id, callback) => { if (id === 'guanlanOpen') handlers.push(callback); }
  });
  const bridge = read('js/mainbridge.js');
  if (bridge.includes('  function bindGuanlanBtn(')) {
    vm.runInContext(fn(bridge, 'openGuanlanWindow') + '\n' + fn(bridge, 'bindGuanlanBtn') +
      '\nbindGuanlanBtn(); bindGuanlanBtn();', ctx);
  } else {
    // Runs the pre-fix real click handler too, so the desktop null-return bug is reproducible.
    const demo = read('js/demo.js');
    vm.runInContext(demo.slice(demo.indexOf("  on('guanlanOpen',"), demo.indexOf("  on('glClose',")), ctx);
  }
  assert.equal(handlers.length, 1, 'bind only one click handler across load events');
  return { click: handlers[0], notices, opened, panel };
}

test('desktop host can return null after opening Guanlan without showing a second inline panel', () => {
  const r = entry({ desktop: true });
  r.click();
  assert.equal(r.opened.length, 1);
  assert.deepEqual(r.opened[0], { url: 'guanlan.html', name: 'qg_guanlan' });
  assert.equal(r.panel.hidden, true, 'main window must never show Guanlan inline');
  assert.equal(r.notices.length, 0, 'native interception is not a blocked popup');
  r.click();
  assert.equal(r.opened[1].name, r.opened[0].name, 'reopening targets the existing named window');
});

test('browser opens Guanlan independently; blocked or failed opens only show an error', () => {
  const success = entry(); success.click();
  assert.equal(success.panel.hidden, true);
  assert.equal(success.notices.length, 0);
  for (const options of [{ blocked: true }, { throws: true }, { desktop: true, throws: true }]) {
    const r = entry(options); r.click();
    assert.equal(r.panel.hidden, true, 'no inline fallback even if opening fails');
    assert.equal(r.notices.length, 1);
    assert.match(r.notices[0], /观澜|新窗口/);
  }
});

test('main page has only a Guanlan launcher; chat and drawing scripts belong to the standalone page', () => {
  const main = read('index.html'), standalone = read('guanlan.html');
  assert.match(main, /id="guanlanOpen"/);
  assert.doesNotMatch(main, /id="(?:guanlan|glDetach|glAsk|glCanvas)"/);
  for (const script of ['demo.js', 'glcanvas.js', 'gltemplates.js']) {
    assert.ok(!main.includes('src="js/' + script + '"'), 'main must not initialize ' + script);
    assert.ok(standalone.includes('src="js/' + script + '"'), 'standalone still loads ' + script);
  }
  assert.match(standalone, /id="glAsk"/);
  assert.match(standalone, /id="glCanvas"/);
});
