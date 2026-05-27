export default class Cache extends Map {
	constructor (resolve) {
		super();
		this.resolve = resolve;
	}

	lookup (key) {
		let value;
		if (!super.has(key)) {
			value = this.resolve(key);
			super.set(key, value);
		}
		return value ?? super.get(key);
	}
}
