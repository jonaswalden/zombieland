import assert from 'node:assert/strict';
import Script from '../script.js';
import { JSDOM } from 'jsdom';

describe('Script', () => {
	describe('.evaluate()', () => {
		it('evaluates script from file path', async () => {
			const dom = new JSDOM('<title>initial value</title>');
			const script = new Script(import.meta.dirname + '/files/source-entry.mjs');

			await script.evaluate(dom.window);

			assert.equal(dom.window.document.title, 'initial value, edit from source entry, edit from source component');
		});

		it('evaluates script from code', async () => {
			const dom = new JSDOM('<title>initial value</title>');
			const script = new Script(`
				document.title += ', edit from script';
			`);

			await script.evaluate(dom.window);

			assert.equal(dom.window.document.title, 'initial value, edit from script');
		});

		it('evaluates script with imports', async function () {
			const dom = new JSDOM('<title>initial value</title>');
			const script = new Script(getTestPath(this), `
				import component from './files/source-component.mjs';
				import packageComponent from 'package-component';
				component();
				packageComponent();
			`);

			await script.evaluate(dom.window);

			assert.equal(dom.window.document.title, 'initial value, edit from source component, edit from package component');
		});

		it('evaluates script with exports', async function () {
			const dom = new JSDOM('<title>with exports</title>');
			const script = new Script(getTestPath(this), `
				export default document.title + '?';
				export const named = document.title + '!';
			`);

			const exports = await script.evaluate(dom.window);

			assert.equal(exports.default, 'with exports?');
			assert.equal(exports.named, 'with exports!');
		});

		it('shares module state in diamond dependency graphs', async () => {
			const ctx = {};
			const script = new Script(import.meta.dirname + '/files/diamond-entry.mjs');

			await script.evaluate(ctx);

			assert.deepEqual(Array.from(ctx.results), [ 1, 2, 3 ]);
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

			assert.equal(exports[0].default, 'once!');
			assert.equal(exports[1].default, 'twice!');
			assert.equal(exports[1].times, 1);
		});
	});
});

function getTestPath (context) {
	return import.meta.filename + '?' + new URLSearchParams({
		test: context.test.title
	});
}
