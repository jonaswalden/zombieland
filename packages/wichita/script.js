import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';
import Cache from './cache.js';
import isPath from './is-path.js';

let s = 0;

export default class Script {
	#identifier = `wichita:code(${s++})`;
	#attributes = {};
	#fileCache;
	#moduleCache;

	constructor (...args) {
		this.#fileCache = new Cache(this.load.bind(this));

		if (args.length === 2) {
			this.#identifier = args[0];
			this.#fileCache.set(this.#identifier, this.#attributes, args[1]);
		}
		else if (isPath(args[0]))
			this.#identifier = args[0];
		else
			this.#fileCache.set(this.#identifier, this.#attributes, args[0]);
	}

	async evaluate (context = {}) {
		this.context = vm.isContext(context) ? context : vm.createContext(context);
		this.#moduleCache = new Cache(this.#link.bind(this));

		const module = await this.#moduleCache.lookup(this.#identifier, this.#attributes);
		module.instantiate();
		await module.evaluate();
		return module.namespace;
	}

	resolve (specifier, referrerIdentifier) {
		return (/^\.*\//.test(specifier)) ?
			path.resolve(path.dirname(referrerIdentifier), specifier) :
			url.fileURLToPath(import.meta.resolve(specifier));
	}

	async load (identifier, attributes) {
		const code = await fs.readFile(identifier, { encoding: 'utf8' });

		switch (attributes?.type) {
			case 'json':
				return 'export default JSON.parse(`' + code.replaceAll('`', '\\`') + '`)';
			case 'text':
				return 'export default `' + code.replaceAll('`', '\\`') + '`';
			default:
				return code;
		}
	}

	async #link (identifier, attributes) {
		const code = await this.#fileCache.lookup(identifier, attributes);
		const module = new vm.SourceTextModule(code, {
			identifier,
			context: this.context,
		});
		const moduleRequests = await Promise.all(
			module.moduleRequests.map(moduleRequest => {
				return this.#moduleCache.lookup(
					this.resolve(moduleRequest.specifier, identifier),
					moduleRequest.attributes
				);
			})
		);
		module.linkRequests(moduleRequests);
		return module;
	}
}
