export default class Cache extends Map {
	constructor (resolve) {
		super();
		this.resolve = resolve;
	}

	has (...path) {
		const key = Cache.serializePath(path);
		return super.has(key);
	}

	get (...path) {
		const key = Cache.serializePath(path);
		return super.get(key);
	}

	set (...path) {
		const value = path.pop();
		const key = Cache.serializePath(path);
		return super.set(key, value);
	}

	delete (...path) {
		const key = Cache.serializePath(path);
		return super.delete(key);
	}

	lookup (...path) {
		const key = Cache.serializePath(path);

		if (super.has(key))
			return super.get(key);

		const value = this.resolve(...path);
		super.set(key, value);
		return value;
	}

	static serializePath (path) {
		return JSON.stringify(path);
	}
}
