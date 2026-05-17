import Cache from './cache.js';
import fs from 'node:fs/promises';
import isPath from './is-path.js';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';

const fsCache = new Cache(key => {
	return fs.readFile(key, { encoding: 'utf8' });
});

const entryCode = `
	import * as exports from "wichita:source";
	import.meta.export(exports);
`;

export default class Script {
	identifier = 'wichita:code';
	code = '';

	constructor (...args) {
		if (args.length === 2) {
			this.identifier = args[0];
			this.code = args[1];
		}
		else if (isPath(args[0])) {
			this.identifier = args[0];
			this.code = fsCache.lookup(this.identifier);
		}
		else {
			this.code = args[0];
		}
	}

	async evaluate (context = {}) {
		let exports = undefined;
		const module = new vm.SourceTextModule(entryCode, {
			identifier: 'wichita:entry',
			context: vm.isContext(context) ?
				context :
				vm.createContext(context),
			initializeImportMeta (meta) {
				meta.export = values => exports = values;
			}
		});
		await module.link(Script.#link.bind(this));
		await module.evaluate();
		return exports;
	}

	static async #link (specifier, referencingModule) {
		let identifier, code;
		if (referencingModule.identifier === 'wichita:entry') {
			identifier = this.identifier;
			code = String(await this.code);
		}
		else {
			[ identifier, code ] = await Script.#resolve(specifier, referencingModule);
		}

		const module = new vm.SourceTextModule(code, {
			identifier,
			context: referencingModule.context,
			importModuleDynamically: Script.#link,
		});
		await module.link(Script.#link);
		return module;
	}

	static async #resolve (specifier, referencingModule) {
		try {
			const identifier = referencingModule ?
				path.resolve(path.dirname(referencingModule.identifier), specifier) :
				url.fileURLToPath(import.meta.resolve(specifier));

			const code = await fsCache.lookup(identifier);
			return [ identifier, code ];
		}
		catch (error) {
			if (!referencingModule) throw error;
			return Script.#resolve(specifier);
		}
	}
}
