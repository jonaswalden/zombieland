import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';
import Cache from './cache.js';
import isPath from './is-path.js';

let s = 0;

export default class Script {
	#identifier = `wichita:code(${s++})`;
	#fileCache;
	#moduleCache;

	constructor (...args) {
		this.#fileCache = new Cache(this.load.bind(this));

		if (args.length === 2) {
			this.#identifier = args[0];
			this.#fileCache.set(this.#identifier, args[1]);
		}
		else if (isPath(args[0]))
			this.#identifier = args[0];
		else
			this.#fileCache.set(this.#identifier, args[0]);
	}

	async evaluate (context = {}) {
		this.context = vm.isContext(context) ? context : vm.createContext(context);
		this.#moduleCache = new Cache(this.#link.bind(this));

		const module = await this.#moduleCache.lookup(this.#identifier);
		module.instantiate();
		await module.evaluate();
		return module.namespace;
	}

	resolve (specifier, parentIdentifier) {
		return (/^\.*\//.test(specifier)) ?
			path.resolve(path.dirname(parentIdentifier), specifier) :
			url.fileURLToPath(import.meta.resolve(specifier));
	}

	load (identifier) {
		return fs.readFile(identifier, { encoding: 'utf8' });
	}

	async #link (identifier) {
		const code = await this.#fileCache.lookup(identifier);
		const module = new vm.SourceTextModule(code, {
			identifier,
			context: this.context,
		});
		const moduleRequests = await Promise.all(
			module.moduleRequests
				.map(r => this.resolve(r.specifier, identifier))
				.map(i => this.#moduleCache.lookup(i))
		);
		module.linkRequests(moduleRequests);
		return module;
	}
}
