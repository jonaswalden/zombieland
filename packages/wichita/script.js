import FSCache from './fs-cache.js';
import isPath from './is-path.js';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';

const fsCache = new FSCache();
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
			this.code = fsCache.get(this.identifier);
		}
		else {
			this.code = args[0];
		}
	}

	async evaluate (context = {}) {
		let exports = undefined;
		const vmContext = vm.isContext(context) ? context : vm.createContext(context);
		const moduleCache = new Map();

		const link = async (specifier, referencingModule) => {
			let identifier, code;
			if (referencingModule.identifier === 'wichita:entry') {
				identifier = this.identifier;
				code = String(await this.code);
			}
			else {
				[ identifier, code ] = await Script.#resolve(specifier, referencingModule);
			}

			let promise = moduleCache.get(identifier);
			if (!promise) {
				promise = (async () => {
					const mod = new vm.SourceTextModule(code, {
						identifier,
						context: vmContext,
						importModuleDynamically: link,
					});
					await mod.link(link);
					return mod;
				})();
				moduleCache.set(identifier, promise);
			}
			return promise;
		};

		const module = new vm.SourceTextModule(entryCode, {
			identifier: 'wichita:entry',
			context: vmContext,
			initializeImportMeta (meta) {
				meta.export = values => exports = values;
			}
		});
		await module.link(link);
		await module.evaluate();
		return exports;
	}

	static async #resolve (specifier, referencingModule) {
		try {
			const identifier = referencingModule ?
				path.resolve(path.dirname(referencingModule.identifier), specifier) :
				url.fileURLToPath(import.meta.resolve(specifier));

			const file = await fsCache.get(identifier);
			return [ identifier, file ];
		}
		catch (error) {
			if (!referencingModule) throw error;
			return Script.#resolve(specifier);
		}
	}
}
