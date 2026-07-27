import jsdom from 'jsdom';
import fsSync from 'node:fs';
import Script from './script.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.filename);

export default class ResourceLoader extends jsdom.ResourceLoader {
	constructor (options = {}, ...args) {
		super(...args);
		this.options = options;
	}

	resolveTag (tag) {
		const attrs = this.options.resolveTag?.(tag);

		switch (typeof attrs) {
			case 'string':
				return { src: attrs, type: 'module' };
			case 'object':
				return attrs && {
					src: attrs.src || tag.src,
					type: attrs.type || tag.type,
				};
			default:
				return { src: tag.src, type: tag.type };
		}
	}

	async runScripts (dom, { noModule = false } = {}) {
		const domContext = dom.getInternalVMContext();

		for (const element of dom.window.document.getElementsByTagName('script')) {
			const attrs = this.resolveTag(element);
			if (attrs === null) continue;
			if (![ 'module', 'text/javascript', '' ].includes(attrs.type)) continue;
			if ((attrs.type === 'module') && noModule) continue;

			const src = attrs.src && new URL(attrs.src, dom.window.location);
			const code = src ?
				await this.fetch(src.href, {
					element,
					cookieJar: dom.cookieJar,
					referrer: dom.window.location,
				}) :
				element.text;
			if (!code) continue;

			await new Script(src.pathname, String(code))
				.evaluate(domContext);
		}
	}

	beforeParse (window) {
		return ResourceLoader.polyfill(window);
	}

	static polyfill (window) {
		for (const p of [ 'whatwg-fetch' ]) {
			const code = fsSync.readFileSync(require.resolve(p), 'utf8');
			window.eval(code);
		}
	}
};
