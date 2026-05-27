import Cache from './cache.js';
import fs from 'node:fs/promises';
import isPath from './is-path.js';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';

let i = 0;

const fsCache = new Cache(filePath => {
	return fs.readFile(filePath, { encoding: 'utf8' });
});

export default class Script {
	identifier = `wichita:code(${i++})`;

	constructor (...args) {
		if (args.length === 2) {
			this.identifier = args[0];
			fsCache.set(this.identifier, args[1]);
		}
		else if (isPath(args[0])) {
			this.identifier = args[0];
		}
		else {
			fsCache.set(this.identifier, args[0]);
		}
	}

	async evaluate (context = {}) {
		context = vm.isContext(context) ?
			context :
			vm.createContext(context);

		const moduleCache = new Cache(resolveModule);
		const link = Script.#link.bind(null, moduleCache);

		const entryModule = await moduleCache.lookup(this.identifier);
		await entryModule.evaluate();
		return entryModule.namespace;

		async function resolveModule (identifier) {
			const code = await fsCache.lookup(identifier);
			const module = new vm.SourceTextModule(code, {
				identifier,
				context,
				importModuleDynamically: link,
			});
			await module.link(link);
			return module;
		}
	}

	static async #link (moduleCache, specifier, referencingModule) {
		const identifier = await (/^\.*\//.test(specifier)) ?
			path.resolve(path.dirname(referencingModule.identifier), specifier) :
			url.fileURLToPath(import.meta.resolve(specifier));

		return moduleCache.lookup(identifier);
	}
}
