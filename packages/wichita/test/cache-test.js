import assert from 'node:assert/strict';

import Cache from '../cache.js';

describe('Cache', () => {
	it('is a map', () => {
		const cache = new Cache();
		assert.equal(cache instanceof Map, true);

		const has1 = cache.has('a');
		assert.equal(has1, false);

		const a1 = Symbol('a');
		cache.set('a', a1);

		const has2 = cache.has('a');
		assert.equal(has2, true);

		const a2 = cache.get('a');
		assert.equal(a1, a2);

		cache.delete('a');

		const has3 = cache.has('a');
		assert.equal(has3, false);
	});

	it('is a deep map', () => {
		const cache = new Cache();

		const has1 = cache.has('abc');
		assert.equal(has1, false);

		const abc1 = Symbol('abc');
		cache.set('a', 'b', 'c', abc1);

		const has2 = cache.has('a', 'b', 'c');
		assert.equal(has2, true);

		const abc2 = cache.get('a', 'b', 'c');
		assert.equal(abc2, abc1);

		cache.delete('a', 'b', 'c');

		const has3 = cache.has('a', 'b', 'c');
		assert.equal(has3, false);
	});

	it('serializes path', () => {
		const cache = new Cache();

		const abc1 = Symbol('abc');
		cache.set({ abc: true }, abc1);

		const abc2 = cache.get({ abc: true });
		assert.equal(abc2, abc1);


		const hasABC = cache.has({ abc: true });
		assert.equal(hasABC, true);

		const hasNotABC = cache.has({ abc: false });
		assert.equal(hasNotABC, false);
	});

	it('looks up value with resolver', () => {
		const cache = new Cache(function (key) {
			return [ this.size, key ];
		});

		assert.equal(cache.has('a'), false);

		const a1 = cache.lookup('a');
		assert.deepEqual(a1, [ 0, 'a' ]);

		const a2 = cache.lookup('a');
		assert.equal(a2, a1);

		const a3 = cache.get('a');
		assert.equal(a3, a1);
	});

	it('looks up deep value with resolver', () => {
		const cache = new Cache(function (...path) {
			return [ this.size, ...path ];
		});

		const abc1 = cache.lookup('a', 'b', 'c');
		assert.deepEqual(abc1, [ 0, 'a', 'b', 'c' ]);

		const abc2 = cache.lookup('a', 'b', 'c');
		assert.equal(abc2, abc1);

		const abc3 = cache.get('a', 'b', 'c');
		assert.equal(abc3, abc1);
	});
});
