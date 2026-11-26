const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  vm.runInNewContext(
    code,
    {
      exports,
      URL,
      ...globals,
      require(name) {
        if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
        return modules[name];
      },
    },
    { filename: file }
  );
  return exports;
}

for (const origin of [
  'chrome-extension://abcdefghijklmnop/',
  'moz-extension://installation-uuid/',
]) {
  test(`header rules only allow the installation origin: ${origin}`, async () => {
    const updates = [];
    const browser = {
      runtime: { getURL: () => origin },
      declarativeNetRequest: {
        updateDynamicRules: async (update) => updates.push(update),
      },
    };
    const { ensureHeaderRules } = load('src/headerRules.ts', {
      'webextension-polyfill': browser,
      './rules.json': require('../src/rules.json'),
    });
    await Promise.all([ensureHeaderRules(), ensureHeaderRules()]);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].addRules.length, 2);
    for (const rule of updates[0].addRules) {
      assert.deepEqual(Array.from(rule.condition.initiatorDomains), [
        new URL(origin).hostname,
      ]);
      assert.equal(
        rule.condition.initiatorDomains.includes('evil.example'),
        false
      );
    }
    assert.equal(
      require('../src/manifest.json').declarative_net_request,
      undefined
    );
  });
}

test('failed rule installation is retried; failed setup prevents any fetch', async () => {
  let attempts = 0;
  const { ensureHeaderRules } = load('src/headerRules.ts', {
    'webextension-polyfill': {
      runtime: { getURL: () => 'chrome-extension://test/' },
      declarativeNetRequest: {
        updateDynamicRules: async () => {
          if (++attempts === 1) throw new Error('registration failed');
        },
      },
    },
    './rules.json': require('../src/rules.json'),
  });
  let fetches = 0;
  const { default: Client, DEFAULT_SETUP_URL } = load(
    'src/iCloudClient.ts',
    {
      './headerRules': { ensureHeaderRules },
    },
    {
      fetch: async () => {
        fetches++;
        return { ok: true, json: async () => ({}) };
      },
    }
  );
  const client = new Client(DEFAULT_SETUP_URL);
  await assert.rejects(client.validateToken(), /registration failed/);
  assert.equal(fetches, 0);
  await client.validateToken();
  assert.equal(fetches, 1);
  assert.equal(attempts, 2);
});

class Element {
  constructor() {
    this.listeners = {};
    this.classList = new Set();
    this.classList.remove = this.classList.delete;
    this.isConnected = true;
  }
  addEventListener(name, fn) {
    this.listeners[name] = fn;
  }
  removeEventListener(name) {
    delete this.listeners[name];
  }
  setAttribute(name, value) {
    this[name] = value;
  }
  removeAttribute(name) {
    delete this[name];
  }
  remove() {
    this.isConnected = false;
  }
}
class Button extends Element {}
class Input extends Element {}

async function contentHarness() {
  const input = new Input();
  let button;
  input.parentNode = {
    insertBefore: (node) => {
      button = node;
      node.isConnected = true;
    },
  };
  const sent = [];
  let receive;
  const types = {
    GenerateRequest: 1,
    GenerateResponse: 2,
    ReservationRequest: 3,
    ReservationResponse: 4,
  };
  const { default: main } = load(
    'src/pages/Content/script.ts',
    {
      '../../messages': { MessageType: types },
      uuid: { v4: () => 'private-button-id' },
      './index.css': {},
      'webextension-polyfill': {
        runtime: {
          sendMessage: async (message) => sent.push(message),
          onMessage: {
            addListener: (fn) => {
              receive = fn;
            },
          },
        },
      },
      '../../storage': { getBrowserStorageValue: async () => undefined },
    },
    {
      document: {
        querySelectorAll: () => [input],
        createElement: () => new Button(),
        body: {},
      },
      window: { location: { host: 'example.com' } },
      Element,
      HTMLButtonElement: Button,
      HTMLInputElement: Input,
      MutationObserver: class {
        observe() {}
      },
    }
  );
  await main();
  await input.listeners.focus();
  receive({
    type: types.GenerateResponse,
    data: { hme: 'alias@example.invalid', elementId: 'private-button-id' },
  });
  return { input, button, sent, receive, types };
}

test('synthetic mouse events cannot reserve an alias', async () => {
  const { button, sent } = await contentHarness();
  button.innerHTML = 'attacker@example.invalid';
  await button.listeners.mousedown({ isTrusted: false, button: 0 });
  assert.equal(sent.length, 1);
});

test('trusted clicks use private alias and ID despite DOM tampering, only once', async () => {
  const { button, sent } = await contentHarness();
  button.innerHTML = 'attacker@example.invalid';
  button.textContent = 'attacker@example.invalid';
  button.id = 'attacker-id';
  const click = { isTrusted: true, button: 0, preventDefault() {} };
  await button.listeners.mousedown(click);
  await button.listeners.mousedown(click);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].data.hme, 'alias@example.invalid');
  assert.equal(sent[1].data.elementId, 'private-button-id');
});

test('blur clears the private alias even if the page reattaches the button', async () => {
  const { input, button, sent } = await contentHarness();
  input.listeners.blur();
  button.isConnected = true;
  await button.listeners.mousedown({ isTrusted: true, button: 0 });
  assert.equal(sent.length, 1);
});
