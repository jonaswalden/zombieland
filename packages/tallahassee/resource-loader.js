import assert from 'node:assert/strict';
import { ResourceLoader as JSDOMResourceLoader } from 'jsdom';

class NonResource {}

const { Stylesheet } = await import('@zombieland/little-rock').catch(fallback);
const { Script } = await import('@zombieland/wichita').catch(fallback);

export default class ResourceLoader extends JSDOMResourceLoader {
	constructor (options) {
		super(options);
	}

	beforeParse (window, painter) {
		console.log(painter);
		this.window = window;
		this.painter = painter;
	}

	load () {}

	fetch (url, options) {
		const resource = this.load(url, options);
		if (resource === null) return resource;
		if (!resource) return super.fetch(url, options);

		if (resource instanceof Stylesheet) {
			console.log('Little rock stylesheet!');
			assert(this.painter, 'Painter is required to handle Stylesheet');
			this.painter.load(resource);
			return Promise.resolve(Buffer.from(''));
		}
		else if (resource instanceof Script) {
			console.log('Wichita script!');
			return resource.evaluate(this.window)
				.then(() => Buffer.from(''));
		}
		else {
			throw new Error('Unknown resource type');
		};
	}
}

function fallback () {
	return {
		Stylesheet: NonResource,
		Script: NonResource
	};
}
