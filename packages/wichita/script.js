import Cache from './cache.js';
import fs from 'node:fs/promises';
import isPath from './is-path.js';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';

let i = 0;

export default class Script {
	#identifier = `wichita:code(${i++})`;
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
		context = vm.isContext(context) ? context : vm.createContext(context);
		const link = this.#link.bind(this);
		this.#moduleCache = new Cache(this.#load.bind(this, context, link));

		const entryModule = await this.#moduleCache.lookup(this.#identifier);
		await entryModule.evaluate();
		return entryModule.namespace;
	}

	resolve (specifier, referencingModule) {
		return (/^\.*\//.test(specifier)) ?
			path.resolve(path.dirname(referencingModule.identifier), specifier) :
			url.fileURLToPath(import.meta.resolve(specifier));
	}

	load (identifier) {
		return fs.readFile(identifier, { encoding: 'utf8' });
	}

	async #link (specifier, referencingModule) {
		const identifier = await this.resolve(specifier, referencingModule);
		return this.#moduleCache.lookup(identifier);
	}

	async #load (context, link, identifier) {
		const code = await this.#fileCache.lookup(identifier);
		const module = new vm.SourceTextModule(code, {
			identifier,
			context,
			importModuleDynamically: link,
		});
		await module.link(link);
		return module;
	}
}
