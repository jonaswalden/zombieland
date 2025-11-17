import Layout from './layout.js';
import Stylesheet from './stylesheet.js';

const sides = [ 'width', 'height' ];
const scrollSides = [ 'scrollWidth', 'scrollHeight' ];
const allSides = [].concat(sides, scrollSides);
const sideByScrollSide = Object.fromEntries(
	scrollSides.map((s, i) => [ s, sides[i] ])
);
const axes = [ 'x', 'y' ];
const sideByAxis = Object.fromEntries(
	axes.map((a, i) => [ a, sides[i] ])
);
const axisBySide = Object.fromEntries(
	sides.map((s, i) => [ s, axes[i] ])
);

export default class Painter {
	window;
	renderTree = new Map();
	elementStyles = new Map();
	stylesheet = new Stylesheet();

	constructor (options = {}) {
		const { window, stylesheet } = options;

		if (stylesheet)
			this.load(stylesheet);
		if (window)
			this.init(window);
	}

	init (window) {
		this.window = window;

		const { innerWidth, innerHeight } = window;
		this.paint(window, { width: innerWidth, height: innerHeight, scrollHeight: 'auto' }, null);

		Object.defineProperties(window, reflectPainter(this, {
			innerWidth: { get: [ Painter.#getDomRect, 'width', false, window ] },
			innerHeight: { get: [ Painter.#getDomRect, 'height', false, window ] },
			scrollX: { get: [ Painter.#getDomRect, 'scrollX', false, window ] },
			scrollY: { get: [ Painter.#getDomRect, 'scrollY', false, window ] },
			pageXOffset: { get: [ Painter.#getDomRect, 'scrollX', false, window ] },
			pageYOffset: { get: [ Painter.#getDomRect, 'scrollY', false, window ] },
			scroll: { value: [ Painter.#scrollTo ] },
			scrollTo: { value: [ Painter.#scrollTo ] },
			scrollBy: { value: [ Painter.#scrollBy ] },
		}));
		Object.defineProperties(window.Element.prototype, reflectPainter(this, {
			scrollWidth: { get: [ Painter.#getDomRect, 'scrollWidth' ] },
			scrollHeight: { get: [ Painter.#getDomRect, 'scrollHeight' ] },
			scrollLeft: { get: [ Painter.#getDomRect, 'scrollX' ], set: [ Painter.#scrollOneTo, 'left' ] },
			scrollTop: { get: [ Painter.#getDomRect, 'scrollY' ], set: [ Painter.#scrollOneTo, 'top' ] },
			scroll: { value: [ Painter.#scrollTo ] },
			scrollTo: { value: [ Painter.#scrollTo ] },
			scrollBy: { value: [ Painter.#scrollBy ] },
			scrollIntoView: { value: [ Painter.#scrollIntoView ] },
			getBoundingClientRect: { value: [ Painter.#getDomRect, [ 'width', 'height', 'x', 'y', 'left', 'right', 'top', 'bottom' ], true ] },
		}));
		Object.defineProperties(window.HTMLElement.prototype, reflectPainter(this, {
			offsetWidth: { get: [ Painter.#getDomRect, 'width' ] },
			offsetHeight: { get: [ Painter.#getDomRect, 'height' ] },
			offsetLeft: { get: [ Painter.#getDomRect, 'x' ] },
			offsetTop: { get: [ Painter.#getDomRect, 'y' ] },
		}));

		return this;
	}

	beforeParse = this.init;

	load (stylesheet) {
		console.log(0, stylesheet);

		this.stylesheet.add(stylesheet.ruleSheet);
		console.log(1, this.stylesheet);
	}

	paint (target, styleChanges, parent) {
		if (typeof target === 'string') {
			this.stylesheet.add({ [target]: styleChanges });
			this.#registerElement(parent || this.window).children.push(target);
		}
		else {
			const styles = this.#requireElementStyles(target, parent);
			Object.assign(styles, styleChanges);
		}

		return this;
	}

	getLayout (element, relative, cache, currentStack) {
		cache = cache || new Map();
		if (cache.has(element)) return cache.get(element);

		const compoundedStyles = [
			...this.stylesheet.getMatchingStyles(element),
			this.elementStyles.get(element),
		]
			.filter(Boolean)
			.reduce((compounded, current) => {
				return Object.assign(compounded, current);
			}, {});

		const autoAxes = axes.filter(a => compoundedStyles[a] === 'auto');
		if (autoAxes.length) {
			if (currentStack) {
				for (const a of autoAxes) compoundedStyles[a] = currentStack[a];
			}
			else {
				const stack = Object.fromEntries(autoAxes.map(a => [ a, 0 ]));
				const siblings = this.renderTree.get(element)?.parent?.children;

				for (const e of siblings || []) {
					if (e === element) break;

					const cs = this.getLayout(e, false, cache, stack);
					for (const a of autoAxes) {
						stack[a] = Math.max(stack[a], (cs[a] || 0) + (cs[sideByAxis[a]] || 0));
					}
				}

				Object.assign(compoundedStyles, stack);
			}
		}

		const autoSides = allSides.filter(s => compoundedStyles[s] === 'auto');
		if (autoSides.length) {
			const stack = Object.fromEntries(autoSides.map(s => [ s, 0 ]));
			const children = this.#getChildElements(element);

			if (Object.hasOwn(stack, 'width')) delete stack.scrollWidth;
			if (Object.hasOwn(stack, 'height')) delete stack.scrollHeight;

			for (const e of children) {
				const cs = this.getLayout(e, false, cache);
				for (const s of Object.keys(stack)) {
					const cside = sideByScrollSide[s] || s;
					stack[s] = Math.max(stack[s], (cs[axisBySide[cside]] || 0) + (cs[cside] || 0));
				}
			}

			Object.assign(compoundedStyles, stack);
		}

		if (relative) {
			this.#getAncestors(element)
				.map(ancestor => this.elementStyles.get(ancestor))
				.filter(Boolean)
				.reduce((styles, ancestorStyles) => {
					return Object.assign(styles, {
						x: (styles.x || 0) - (ancestorStyles.scrollX || 0),
						y: (styles.y || 0) - (ancestorStyles.scrollY || 0),
					});
				}, compoundedStyles);
		}

		const layout = new Layout(compoundedStyles);
		cache.set(element, layout);
		return layout;
	}

	#getChildElements (element) {
		const children = new Set(
			this.renderTree.get(element).children
				.map(c => typeof c === 'string' ? Array.from((element.document || element).querySelectorAll(c)) : c)
				.flat()
		);

		for (const child of children) {
			this.#requireElementStyles(child, element, true);
		}

		return children;
	}

	#getAncestors (element) {
		const ancestors = [];
		let parent = element;
		while ((parent = this.renderTree.get(parent)?.parent)) {
			ancestors.push(parent);
		}
		return ancestors;
	}

	#registerElement (element, parent, live) {
		if (this.renderTree.has(element))
			return this.renderTree.get(element);

		this.elementStyles.set(element, {});
		this.renderTree.set(element, {
			parent: typeof parent === 'undefined' ? this.window : parent,
			children: [],
		});

		if (parent && !live) {
			this.#registerElement(parent);
			this.renderTree.get(parent).children.push(element);
		}

		return this.renderTree.get(element);
	}

	#requireElementStyles (element, parent, live) {
		this.#registerElement(element, parent, live);
		return this.elementStyles.get(element);
	}

	static #scrollTo (painter, scrollX, scrollY) {
		if (typeof scrollX === 'object') {
			({ left: scrollX, top: scrollY } = scrollX);
		}

		painter.paint(this, { scrollX, scrollY });
		this.dispatchEvent(new painter.window.Event('scroll'));
	}

	static #scrollOneTo (painter, scrollAxis, value) {
		Painter.#scrollTo.call(this, painter, { [scrollAxis]: value });
	}

	static #scrollBy (painter, scrollXDelta, scrollYDelta) {
		if (typeof scrollXDelta === 'object') {
			({ left: scrollXDelta, top: scrollYDelta } = scrollXDelta);
		}

		const layout = painter.getLayout(this);
		const scrollX = layout.scrollX + scrollXDelta;
		const scrollY = layout.scrollY + scrollYDelta;
		Painter.#scrollTo.call(this, painter, scrollX, scrollY);
	}

	static #scrollIntoView (painter) {
		const { x, y } = painter.getLayout(this);
		Painter.#scrollTo.call(this.ownerDocument.defaultView, painter, x, y);
	}

	static #getDomRect (painter, props, relative, self) {
		const layout = painter.getLayout(self || this, relative);
		if (typeof props === 'string') return layout[props];
		return props.reduce((rect, prop) => {
			rect[prop] = layout[prop];
			return rect;
		}, {});
	}
};

function reflectPainter (painter, descriptorsByProp) {
	const props = {};

	for (const [ prop, descriptor ] of Object.entries(descriptorsByProp)) {
		props[prop] = {};

		for (const [ key, descriptorArgs ] of Object.entries(descriptor)) {
			const [ fn, ...rArgs ] = descriptorArgs;

			props[prop][key] = function (...args) {
				return Reflect.apply(fn, this, [ painter, ...rArgs, ...args ]);
			};
		}
	}

	return props;
}
