import assert from 'node:assert/strict';
import Painter from '../painter.js';
import pick from 'lodash.pick';
import Stylesheet from '../stylesheet.js';
import { JSDOM } from 'jsdom';

describe('Painter', () => {
	describe('Web APIs', () => {
		let dom, window, element;
		beforeEach('load DOM', () => {
			dom = new JSDOM('<div>HTMLElement</div>');
			window = dom.window;
			element = window.document.querySelector('div');
		});

		let painter;
		beforeEach('initialize painter', () => {
			painter = new Painter({ window });
		});

		beforeEach('paint non-default viewport', () => {
			painter.paint(window, {
				width: 900,
				height: 1600,
				scrollWidth: 1000,
				scrollHeight: 2000,
				scrollX: 20,
				scrollY: 10,
			});
		});

		beforeEach('paint non-default layout', () => {
			painter.paint(element, {
				width: 150,
				height: 250,
				scrollWidth: 450,
				scrollHeight: 300,
				x: 50,
				y: 20,
				scrollX: 20,
				scrollY: 10,
			});
		});

		describe('Element', () => {
			beforeEach('is instance of Element', () => {
				assert(element instanceof dom.window.Element);
			});

			it('.scrollWidth', () => {
				assert.equal(element.scrollWidth, 450);
			});

			it('.scrollHeight', () => {
				assert.equal(element.scrollHeight, 300);
			});

			it('.scrollLeft', () => {
				assert.equal(element.scrollLeft, 20);
			});

			it('.scrollTop', () => {
				assert.equal(element.scrollTop, 10);
			});

			it('.getBoundingClientRect()', () => {
				assert.deepEqual(element.getBoundingClientRect(), {
					width: 150,
					height: 250,
					x: 30,
					y: 10,
					left: 30,
					right: 180,
					top: 10,
					bottom: 260,
				});
			});

			it('.scroll(xCoord, yCoord)', () => {
				const pendingScroll = captureScroll(element);

				element.scroll(30, 50);
				assert.equal(element.scrollLeft, 30);
				assert.equal(element.scrollTop, 50);

				return pendingScroll;
			});

			it('.scroll(options)', () => {
				const pendingScroll = captureScroll(element);

				element.scroll({ left: 30, top: 50 });
				assert.equal(element.scrollLeft, 30);
				assert.equal(element.scrollTop, 50);

				return pendingScroll;
			});

			it('.scrollTo(xCoord, yCoord)', () => {
				const pendingScroll = captureScroll(element);

				element.scrollTo(30, 50);
				assert.equal(element.scrollLeft, 30);
				assert.equal(element.scrollTop, 50);

				return pendingScroll;
			});

			it('.scrollTo(options)', () => {
				const pendingScroll = captureScroll(element);

				element.scrollTo({ left: 30, top: 50 });
				assert.equal(element.scrollLeft, 30);
				assert.equal(element.scrollTop, 50);

				return pendingScroll;
			});

			it('.scrollBy(xCoord, yCoord)', () => {
				const pendingScroll = captureScroll(element);

				element.scrollBy(10, 10);
				assert.equal(element.scrollLeft, 30);
				assert.equal(element.scrollTop, 20);

				return pendingScroll;
			});

			it('.scrollBy(options)', () => {
				const pendingScroll = captureScroll(element);

				element.scrollBy({ left: 10, top: 10 });
				assert.equal(element.scrollLeft, 30);
				assert.equal(element.scrollTop, 20);

				return pendingScroll;
			});

			it('.scrollIntoView()', () => {
				const pendingScroll = captureScroll(window);

				element.scrollIntoView();
				assert.equal(window.scrollX, 50);
				assert.equal(window.scrollY, 20);
				assert.equal(window.pageXOffset, 50);
				assert.equal(window.pageYOffset, 20);

				return pendingScroll;
			});
		});

		describe('HTMLElement', () => {
			beforeEach('is instance of HTMLElement', () => {
				assert(element instanceof dom.window.HTMLElement);
			});

			it('.offsetWidth', () => {
				assert.equal(element.offsetWidth, 150);
			});

			it('.offsetHeight', () => {
				assert.equal(element.offsetHeight, 250);
			});

			it('.offsetLeft', () => {
				assert.equal(element.offsetLeft, 50);
			});

			it('.offsetTop', () => {
				assert.equal(element.offsetTop, 20);
			});
		});

		describe('Window', () => {
			beforeEach('is instance of Window', () => {
				assert(window instanceof dom.window.Window);
			});

			it('.innerWidth', () => {
				assert.equal(window.innerWidth, 900);
			});

			it('.innerHeight', () => {
				assert.equal(window.innerHeight, 1600);
			});

			it('.scrollX', () => {
				assert.equal(window.scrollX, 20);
			});

			it('.scrollY', () => {
				assert.equal(window.scrollY, 10);
			});

			it('.pageXOffset', () => {
				assert.equal(window.pageXOffset, 20);
			});

			it('.pageYOffset', () => {
				assert.equal(window.pageYOffset, 10);
			});

			it('.scroll(xCoord, yCoord)', () => {
				const pendingScroll = captureScroll(window);

				window.scroll(30, 60);
				assert.equal(window.scrollX, 30);
				assert.equal(window.scrollY, 60);
				assert.equal(window.pageXOffset, 30);
				assert.equal(window.pageYOffset, 60);

				return pendingScroll;
			});

			it('.scroll(options)', () => {
				const pendingScroll = captureScroll(window);

				window.scroll({ left: 30, top: 60 });
				assert.equal(window.scrollX, 30);
				assert.equal(window.scrollY, 60);
				assert.equal(window.pageXOffset, 30);
				assert.equal(window.pageYOffset, 60);

				return pendingScroll;
			});

			it('.scrollTo(xCoord, yCoord)', () => {
				const pendingScroll = captureScroll(window);

				window.scrollTo(30, 60);
				assert.equal(window.scrollX, 30);
				assert.equal(window.scrollY, 60);
				assert.equal(window.pageXOffset, 30);
				assert.equal(window.pageYOffset, 60);

				return pendingScroll;
			});

			it('.scrollTo(options)', () => {
				const pendingScroll = captureScroll(window);

				window.scrollTo({ left: 30, top: 60 });
				assert.equal(window.scrollX, 30);
				assert.equal(window.scrollY, 60);
				assert.equal(window.pageXOffset, 30);
				assert.equal(window.pageYOffset, 60);

				return pendingScroll;
			});

			it('.scrollBy(xCoord, yCoord)', () => {
				const pendingScroll = captureScroll(window);

				window.scrollBy(10, 10);
				assert.equal(window.scrollX, 30);
				assert.equal(window.scrollY, 20);
				assert.equal(window.pageXOffset, 30);
				assert.equal(window.pageYOffset, 20);

				return pendingScroll;
			});

			it('.scrollBy(options)', () => {
				const pendingScroll = captureScroll(window);

				window.scrollBy({ left: 10, top: 10 });
				assert.equal(window.scrollX, 30);
				assert.equal(window.scrollY, 20);
				assert.equal(window.pageXOffset, 30);
				assert.equal(window.pageYOffset, 20);

				return pendingScroll;
			});
		});
	});

	describe('scrolling', () => {
		let dom, window, ancestorElement, parentElement, childElements;
		beforeEach('load DOM', () => {
			dom = new JSDOM(`
				<article>
					<div>
						<img>
						<img>
					</div>
				</article>
			`);
			window = dom.window;
			ancestorElement = window.document.querySelector('article');
			parentElement = ancestorElement.firstElementChild;
			childElements = parentElement.children;
		});

		let painter;
		beforeEach('initialize painter', () => {
			painter = new Painter({ window });
		});

		beforeEach('paint layout', () => {
			painter.paint(ancestorElement, { width: 400, y: 50 });
			painter.paint(parentElement, { width: 400, y: 70 }, ancestorElement);
			painter.paint(childElements[0], { x: 0, width: 400, y: 70 }, parentElement);
			painter.paint(childElements[1], { x: 400, width: 400, y: 70 }, parentElement);
		});

		it('scrolling window paints descendants', () => {
			dom.window.scrollTo(0, 50);

			assert.deepEqual(
				pick(ancestorElement.getBoundingClientRect(), 'x', 'y'),
				{ x: 0, y: 0 }
			);
			assert.deepEqual(
				pick(parentElement.getBoundingClientRect(), 'x', 'y'),
				{ x: 0, y: 20 }
			);
			assert.deepEqual(
				pick(childElements[0].getBoundingClientRect(), 'x', 'y'),
				{ x: 0, y: 20 }
			);
			assert.deepEqual(
				pick(childElements[1].getBoundingClientRect(), 'x', 'y'),
				{ x: 400, y: 20 }
			);
		});

		it('scrolling ancestor paints descendants', () => {
			ancestorElement.scrollTo(0, 50);
			parentElement.scrollTo(400, 0);

			assert.deepEqual(
				pick(ancestorElement.getBoundingClientRect(), 'x', 'y'),
				{ x: 0, y: 50 }
			);
			assert.deepEqual(
				pick(parentElement.getBoundingClientRect(), 'x', 'y'),
				{ x: 0, y: 20 }
			);
			assert.deepEqual(
				pick(childElements[0].getBoundingClientRect(), 'x', 'y'),
				{ x: -400, y: 20 }
			);
			assert.deepEqual(
				pick(childElements[1].getBoundingClientRect(), 'x', 'y'),
				{ x: 0, y: 20 }
			);
		});

		it('scrolling descendant into view paints ancestors', () => {
			painter.paint(ancestorElement, { height: 400, scrollHeight: 4000 });
			painter.paint(parentElement, { y: 200, height: 1000, scrollHeight: 4000 });
			painter.paint(childElements[0], { y: 3400, height: 300 });
			painter.paint(childElements[1], { y: 3700, height: 300 });

			childElements[1].scrollIntoView();
			console.log(ancestorElement.scrollTop)
			console.log(parentElement.scrollTop)
			console.log(childElements[1].getBoundingClientRect())

			// assert.deepEqual(
			// 	pick(childElements[0].getBoundingClientRect(), 'y'),
			// 	{ y: -300 }
			// );
			assert.deepEqual(
				pick(childElements[1].getBoundingClientRect(), 'y'),
				{ y: 0 }
			);
			assert.deepEqual(ancestorElement.scrollTop, 200);
			assert.deepEqual(parentElement.scrollTop, 3400);
			// assert.deepEqual(
			// 	pick(parentElement.getBoundingClientRect(), 'y'),
			// 	{ y: 20 }
			// );
		});
	});

	describe('options.stylesheet', () => {
		before('defaults bounding box values to 0', async () => {
			const dom = new JSDOM('<div>HTMLElement</div>');
			new Painter().init(dom.window);

			const element = dom.window.document.querySelector('div');
			assert.deepEqual(element.getBoundingClientRect(), {
				width: 0,
				height: 0,
				x: 0,
				y: 0,
				left: 0,
				right: 0,
				top: 0,
				bottom: 0,
			});
		});

		it('styles multiple elements', async () => {
			const dom = new JSDOM(`
				<div>HTMLElement</div>
				<div>HTMLElement</div>
			`);
			const stylesheet = new Stylesheet({
				'*': { x: 50, y: 20, width: 150, height: 250 },
			});
			new Painter({ stylesheet }).init(dom.window);

			const matchingElements = dom.window.document.querySelectorAll('*');
			for (const element of matchingElements) {
				assert.deepEqual(element.getBoundingClientRect(), {
					width: 150,
					height: 250,
					x: 50,
					y: 20,
					left: 50,
					right: 200,
					top: 20,
					bottom: 270,
				});
			}
		});

		it('compounds multiple matching styles', async () => {
			const dom = new JSDOM(`
				<h1>A heading</h1>
				<p>A paragraph…</p>
			`);
			const stylesheet = new Stylesheet({
				'*': { width: 375 },
				'h1': { height: 36 },
				'p': { height: 160, y: 36 },
			});
			new Painter({ stylesheet }).init(dom.window);

			const [ h1, p ] = dom.window.document.body.children;
			assert.deepEqual(h1.getBoundingClientRect(), {
				width: 375,
				height: 36,
				x: 0,
				y: 0,
				left: 0,
				right: 375,
				top: 0,
				bottom: 36,
			});
			assert.deepEqual(p.getBoundingClientRect(), {
				width: 375,
				height: 160,
				x: 0,
				y: 36,
				left: 0,
				right: 375,
				top: 36,
				bottom: 196,
			});
		});

		it('uses selector specificity to resolve conflicting styles', async () => {
			const dom = new JSDOM(`
				<h1 id="the-heading" class="heading">
					A heading
				</h1>
			`);
			const stylesheet = new Stylesheet({
				'#the-heading': { height: 30 },
				'h1, h2': { height: 10 },
				'.heading': { height: 20 },
				'*': { height: 0 },
			});
			new Painter({ stylesheet }).init(dom.window);

			const h1 = dom.window.document.body.querySelector('h1');
			assert.deepEqual(h1.offsetHeight, 30);
		});

		it('element styles supersede stylesheet styles', async () => {
			const dom = new JSDOM(`
				<div id="element">HTMLElement</div>
			`);
			const stylesheet = new Stylesheet({
				'#element': { width: 100, height: 100 },
			});
			const painter = new Painter({ window: dom.window, stylesheet });

			const element = dom.window.document.getElementById('element');
			painter.paint(element, { width: 200 });
			assert.deepEqual(element.offsetWidth, 200);
			assert.deepEqual(element.offsetHeight, 100);
		});
	});

	describe('.paint', () => {
		let painter, divs, spans, elements;
		beforeEach(() => {
			const dom = new JSDOM(`
				<div>HTMLElement</div>
				<span>HTMLSpanElement</span>
			`);
			painter = new Painter(dom);
			divs = dom.window.document.querySelectorAll('div');
			spans = dom.window.document.querySelectorAll('span');
			elements = dom.window.document.querySelectorAll('*');
		});

		it('paints element', () => {
			const [ element ] = elements;
			painter.paint(element, { height: 16, y: 10 });

			assert.equal(element.offsetHeight, 16);
			assert.equal(element.offsetTop, 10);
		});

		it('paints elements with selector', () => {
			painter.paint('div', { height: 16, y: 10 });

			for (const div of divs) {
				assert.equal(div.offsetHeight, 16);
				assert.equal(div.offsetTop, 10);
			}
			for (const span of spans) {
				assert.equal(span.offsetHeight, 0);
				assert.equal(span.offsetTop, 0);
			}
		});

		it('repaints element, updating element styles', () => {
			const [ element ] = elements;
			painter.paint(element, { height: 16, y: 10 });

			assert.equal(element.offsetHeight, 16);
			assert.equal(element.offsetTop, 10);

			painter.paint(element, { height: 32 });

			assert.equal(element.offsetHeight, 32);
			assert.equal(element.offsetTop, 10);
		});

		it('repaints elements with selector, replacing stylesheet entry', () => {
			painter.paint('div', { height: 16, y: 10 });
			painter.paint('span', { height: 6, y: 1 });

			for (const div of divs) {
				assert.equal(div.offsetHeight, 16);
				assert.equal(div.offsetTop, 10);
			}
			for (const span of spans) {
				assert.equal(span.offsetHeight, 6);
				assert.equal(span.offsetTop, 1);
			}

			painter.paint('div', { height: 32 });

			for (const div of divs) {
				assert.equal(div.offsetHeight, 32);
				assert.equal(div.offsetTop, 0);
			}
			for (const span of spans) {
				assert.equal(span.offsetHeight, 6);
				assert.equal(span.offsetTop, 1);
			}
		});
	});

	describe('automatic layout', () => {
		let dom, painter;
		beforeEach(() => {
			dom = new JSDOM(`
				<header></header>
				<article>
					<img />
					<img />
					<img />
				</article>
			`);
			painter = new Painter(dom);
		});

		[
			[ 'width', 'x', 'offsetWidth', 'offsetLeft' ],
			[ 'height', 'y', 'offsetHeight', 'offsetTop' ],
		].forEach(([ side, axis, sideProperty, axisProperty ]) => {
			it(`works with ${side} / ${axis}`, () => {
				const article = dom.window.document.querySelector('article');
				const [ img1, img2, img3 ] = article.children;

				painter.paint(article, { [side]: 'auto' });
				painter.paint(img1, { [side]: 100, [axis]: 'auto' }, article);
				painter.paint(img2, { [side]: 300, [axis]: 'auto' }, article);
				painter.paint(img3, { [side]: 200, [axis]: 'auto' }, article);

				assert.equal(article[sideProperty], 600);
				assert.equal(img1[axisProperty], 0);
				assert.equal(img2[axisProperty], 100);
				assert.equal(img3[axisProperty], 400);
			});
		});

		[
			[ 'scrollWidth', 'width', 'x', 'offsetWidth' ],
			[ 'scrollHeight', 'height', 'y', 'offsetHeight' ],
		].forEach(([ scrollSide, side, axis, sideProperty, scrollSideProperty = scrollSide ]) => {
			it(`works with ${scrollSide} / ${side}`, () => {
				const article = dom.window.document.querySelector('article');
				const [ img1, img2, img3 ] = article.children;

				painter.paint(article, { [side]: 400, [scrollSide]: 'auto' });
				painter.paint(img1, { [side]: 100, [axis]: 'auto' }, article);
				painter.paint(img2, { [side]: 300, [axis]: 'auto' }, article);
				painter.paint(img3, { [side]: 200, [axis]: 'auto' }, article);

				assert.equal(article[sideProperty], 400);
				assert.equal(article[scrollSideProperty], 600);
			});
		});

		it('works with dynamic content', () => {
			const article = dom.window.document.querySelector('article');
			const imgs = article.getElementsByTagName('img');

			painter.paint(article, { height: 'auto' });
			painter.paint('img', { height: 100, y: 'auto' }, article);

			assert.equal(article.offsetHeight, 300);
			assert.equal(imgs[2].offsetTop, 200);

			article.appendChild(dom.window.document.createElement('img'));

			assert.equal(article.offsetHeight, 400);
			assert.equal(imgs[3].offsetTop, 300);

			imgs[0].remove();

			assert.equal(article.offsetHeight, 300);
			assert.equal(imgs[2].offsetTop, 200);
		});
	});
});

function captureScroll (target) {
 	const window = target.window || target.ownerDocument.defaultView;
	return new Promise(resolve => {
		target.addEventListener('scroll', function (...args) {
			resolve([ this, args ])
		}, { once: true });
	})
		.then(([ handlerThis, handlerArgs ]) => {
			assert.equal(handlerThis, target);
			assert.equal(handlerArgs.length, 1);

			const [ handlerEvent ] = handlerArgs;
			assert(handlerEvent instanceof window.Event);
			assert.equal(handlerEvent.type, 'scroll');
			assert.equal(handlerEvent.target, target);
		});
}
