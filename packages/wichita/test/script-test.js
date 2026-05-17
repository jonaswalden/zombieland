import assert from 'node:assert';
import Script from '../script.js';
import { JSDOM } from 'jsdom';

describe('Script', () => {
	describe('.evaluate()', () => {
		it('evaluates script from file path', async () => {
			const dom = new JSDOM('<title>initial value</title>');
			const script = new Script(import.meta.dirname + '/files/source-entry.mjs');

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

		it('evaluates script multiple times', async function () {
			const dom1 = new JSDOM('<title>once</title>');
			const dom2 = new JSDOM('<title>twice</title>');
			const script = new Script(getTestPath(this), `
				let i = 0;
				export default document.title + '!';
				export const times = ++i;
			`);

			const exports = await Promise.all([
				script.evaluate(dom1.window),
				script.evaluate(dom2.window),
			]);

			assert.strictEqual(exports[0].default, 'once!');
			assert.strictEqual(exports[1].default, 'twice!');
			assert.strictEqual(exports[1].times, 1);
		});
	});
});

function getTestPath (context) {
	return import.meta.filename + '?' + new URLSearchParams({
		test: context.test.title
	});
}
