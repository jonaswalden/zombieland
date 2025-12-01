import assert from 'node:assert/strict';
import Script from '../script.js';
import { Window } from 'happy-dom';

describe('Script', () => {
	describe('.evaluate()', () => {
		it('evaluates script from file path', async () => {
			const window = new Window();
			window.document.write('<title>initial value</title>');
			const script = new Script(import.meta.dirname + '/files/source-entry.mjs');

			await script.evaluate(window);

			assert.equal(window.document.title, 'initial value, edit from source entry, edit from source component');
		});

		it('evaluates script from code', async () => {
			const window = new Window();
			window.document.write('<title>initial value</title>');
			const script = new Script(`
				document.title += ', edit from script';
			`);

			await script.evaluate(window);

			assert.equal(window.document.title, 'initial value, edit from script');
		});

		it('evaluates script with imports', async function () {
			const window = new Window();
			window.document.write('<title>initial value</title>');
			const script = new Script(getTestPath(this), `
				import component from './files/source-component.mjs';
				import packageComponent from 'package-component';
				component();
				packageComponent();
			`);

			await script.evaluate(window);

			assert.equal(window.document.title, 'initial value, edit from source component, edit from package component');
		});

		it('evaluates script with exports', async function () {
			const window = new Window();
			window.document.write('<title>with exports</title>');
			const script = new Script(getTestPath(this), `
				export default document.title + '?';
				export const named = document.title + '!';
			`);

			const exports = await script.evaluate(window);

			assert.equal(exports.default, 'with exports?');
			assert.equal(exports.named, 'with exports!');
		});

		it('evaluates script multiple times', async function () {
			const window1 = new Window();
			window1.document.write('<title>once</title>');
			const window2 = new Window();
			window2.document.write('<title>twice</title>');
			const script = new Script(getTestPath(this), `
				let i = 0;
				export default document.title + '!';
				export const times = ++i;
			`);

			const exports = await Promise.all([
				script.evaluate(window1),
				script.evaluate(window2),
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
