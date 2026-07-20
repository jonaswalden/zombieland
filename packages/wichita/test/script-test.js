import assert from 'node:assert';
import path from 'node:path';
import Script from '../script.js';
import { JSDOM } from 'jsdom';

describe('Script', () => {
	describe('.evaluate()', () => {
		it('evaluates script from file path', async () => {
			const dom = new JSDOM('<title>initial value</title>');
			const script = new Script(path.join(import.meta.dirname, 'files', 'source-entry.mjs'));

			const { _helperMemory } = await script.evaluate(dom.window);

			assert.strictEqual(dom.window.document.title, 'initial value, update from source entry, update from source component');
			assert.deepEqual(_helperMemory, [ 'update from source entry', 'update from source component' ]);
		});

		it('evaluates script from code', async () => {
			const dom = new JSDOM('<title>initial value</title>');
			const script = new Script(`
				document.title += ', update from script';
			`);

			await script.evaluate(dom.window);

			assert.strictEqual(dom.window.document.title, 'initial value, update from script');
		});

		it('evaluates script with exports', async function () {
			const dom = new JSDOM('<title>with exports</title>');
			const script = new Script(getTestPath(this), `
				export default document.title + '?';
				export const named = document.title + '!';
			`);

			const exports = await script.evaluate(dom.window);

			assert.strictEqual(exports.default, 'with exports?');
			assert.strictEqual(exports.named, 'with exports!');
		});

		it('evaluates script with imports', async function () {
			const dom = new JSDOM('<title>initial value</title>');
			const script = new Script(getTestPath(this), `
				import component from './files/source-component/source-component.mjs';
				import packageComponent from 'package-component';
				component();
				packageComponent();
			`);

			await script.evaluate(dom.window);

			assert.strictEqual(dom.window.document.title, 'initial value, update from source component, update from package component');
		});

		it('evaluates script with non-js imports', async function () {
			const dom = new JSDOM('');
			const script = new Script(getTestPath(this), `
				export { default as json } from './files/non-js-dependency.json' with { type: 'json' };
				export { default as text } from './files/non-js-dependency.md' with { type: 'text' };
			`);

			const exports = await script.evaluate(dom.window);

			assert.deepEqual(exports.json, { id: 'json-dependency' });
			assert.strictEqual(exports.text, 'dependency of type `"text"`\n');
		});

		it('evaluates script multiple times', async function () {
			const dom1 = new JSDOM('<title>once</title>');
			const dom2 = new JSDOM('<title>twice</title>');
			const script = new Script(getTestPath(this), `
				let i = 0;
				export default document.title + '!';
				export const times = ++i;
			`);

			const exports1 = await script.evaluate(dom1.window);
			const exports2 = await script.evaluate(dom2.window);

			assert.strictEqual(exports1.default, 'once!');
			assert.strictEqual(exports2.default, 'twice!');
			assert.strictEqual(exports2.times, 1);
		});
	});

	describe('.resolve()', () => {
		it('enables custom resolving', async function () {
			class ScriptWithCustomResolver extends Script {
				resolve (specifier, parentIdentifier) {
					if (specifier !== 'dependency')
						return super.resolve(specifier, parentIdentifier);

					return path.resolve('./test/files/mock-dependency.mjs');
				}
			}

			const dom = new JSDOM('<title>initial value</title>');
			const script = new ScriptWithCustomResolver(getTestPath(this), `
				import dependency from 'dependency';
				import update from './files/helpers/update.mjs';

				update(dependency);
			`);

			await script.evaluate(dom.window);

			assert.strictEqual(dom.window.document.title, 'initial value, update from mock dependency');
		});
	});

	describe('.load()', () => {
		it('enables custom loading', async function () {
			class ScriptWithCustomLoader extends Script {
				load (identifier) {
					if (!identifier.endsWith('custom-component.mjs'))
						return super.load(identifier);

					return Promise.resolve(`
						import update from '../helpers/update.mjs';

						export default function component () {
							update('custom component');
						}
					`);
				}
			}

			const dom = new JSDOM('<title>initial value</title>');
			const script = new ScriptWithCustomLoader(getTestPath(this), `
				import update, { memory as _helperMemory } from './files/helpers/update.mjs';
				import component from './files/source-component/source-component.mjs';
				import customComponent from './files/custom-component/custom-component.mjs';

				update('entry');
				component();
				customComponent();

				export { _helperMemory };
			`);

			const { _helperMemory } = await script.evaluate(dom.window);

			assert.strictEqual(dom.window.document.title, 'initial value, update from entry, update from source component, update from custom component');
			assert.deepEqual(_helperMemory, [ 'update from entry', 'update from source component', 'update from custom component' ]);
		});
	});
});

function getTestPath (context) {
	return import.meta.filename + '?' + new URLSearchParams({
		test: context.test.title
	});
}
