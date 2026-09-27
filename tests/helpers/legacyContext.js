import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function loadLegacyContext(...files) {
  const values = new Map();
  const sandbox = {
    console: { warn() {}, log() {} },
    performance: { now: () => 0 },
    document: {
      documentElement: { style: { setProperty() {} }, classList: { toggle() {} } },
      addEventListener() {},
      hidden: false,
    },
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
      clear: () => values.clear(),
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  files.forEach((path) => {
    vm.runInContext(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'), sandbox, { filename: path });
  });
  return sandbox;
}
