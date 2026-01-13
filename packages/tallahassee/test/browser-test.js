import assert from 'node:assert/strict';
import Browser from '../h-d-browser.js';
import nock from 'nock';
import parseFormData from '../../../helpers/parse-form-data.js';

describe('Browser', () => {
	before(() => nock.disableNetConnect());
	beforeEach(() => nock.cleanAll());

	const url = new URL('http://example.com/');
	let browser;
	beforeEach(() => {
		browser = new Browser();
	});
	after(() => nock.enableNetConnect());

	describe('.navigateTo()', () => {
		it('navigates to document with URL', async () => {
			nock(url.origin)
				.get(url.pathname)
				.reply(200, '<title>Document from URL');

			const page = await browser.navigateTo(url);
			assert(page.document.title, 'Document from URL');
		});
	});

	describe('.fetch()', () => {
		it('fetches resource with url and options', async () => {
			nock(url.origin)
				.post(url.pathname)
				.reply(function (path, body) {
					assert.equal(this.req.headers['req-header'], 'value');
					assert.equal(body, 'request body');
					return [ 200, 'response body', { 'res-header': 'value' } ];
				});

			const response = await browser.fetch(url, {
				method: 'post',
				headers: { 'req-header': 'value' },
				body: 'request body',
			});

			assert.equal(response.status, 200);
			assert.equal(response.headers.get('res-header'), 'value');

			const responseBody = await response.text();
			assert.equal(responseBody, 'response body');
		});

		it('fetches resource with request', async () => {
			nock(url.origin)
				.post(url.pathname)
				.reply(function (path, body) {
					assert.equal(this.req.headers['req-header'], 'value');
					assert.equal(body, 'request body');
					return [ 200, 'response body', { 'res-header': 'value' } ];
				});

			const request = new Request(url, {
				method: 'post',
				headers: { 'req-header': 'value' },
				body: 'request body',
			});
			const response = await browser.fetch(request);

			assert.equal(response.status, 200);
			assert.equal(response.headers.get('res-header'), 'value');

			const responseBody = await response.text();
			assert.equal(responseBody, 'response body');
		});

		[
			[ 301, 'moved-permanently' ],
			[ 302, 'found' ],
			[ 303, 'see-other' ],
		].forEach(([ status, location ]) => {
			it(`follows ${status} redirect`, async () => {
				nock(url.origin)
					.post(url.pathname)
					.reply(status, undefined, { location: `/${location}` })
					.get(`/${location}`)
					.reply(function (path, body) {
						const { headers } = this.req;
						assert.equal(headers['initial-request-header'], undefined);
						assert.equal(body, '');
						return [ 200 ];
					});

				const response = await browser.fetch(url, {
					method: 'post',
					headers: { 'initial-request-header': 'value' },
					body: 'initial request body',
				});

				assert.equal(response.status, 200);
			});
		});

		[
			[ 307, 'temporary-redirect' ],
			[ 308, 'permanent-redirect' ],
		].forEach(([ status, location ]) => {
			it(`follows ${status} redirect with method and body unchanged`, async () => {
				nock(url.origin)
					.post(url.pathname)
					.reply(status, undefined, { location: `/${location}` })
					.post(`/${location}`)
					.reply(function (path, body) {
						const { headers } = this.req;
						assert.equal(headers['initial-request-header'], undefined);
						assert.equal(body, 'initial request body');
						return [ 200 ];
					});

				const response = await browser.fetch(url, {
					method: 'post',
					headers: { 'initial-request-header': 'value' },
					body: 'initial request body',
				});

				assert.equal(response.status, 200);
			});
		});

		it('persists request cookies to cookie jar', async () => {
			nock(url.origin)
				.get('/requires-authentication')
				.times(2)
				.reply(function () {
					assert.equal(this.req.headers.cookie, 'logged-in=1');
					return [ 200, 'OK' ];
				});

			await browser.fetch(
				url.origin + '/requires-authentication',
				{ headers: { cookie: 'logged-in=1' } }
			);

			const response = await browser.fetch(url.origin + '/requires-authentication');
			assert.equal(response.status, 200);
		});

		it('persists response cookies to cookie jar', async () => {
			nock(url.origin)
				.post('/login')
				.reply(200, 'OK', { 'set-cookie': 'logged-in=1' })
				.get('/requires-authentication')
				.reply(function () {
					assert.equal(this.req.headers.cookie, 'logged-in=1');
					return [ 200, 'OK' ];
				});

			await browser.fetch(url.origin + '/login', { method: 'post' });
			const response = await browser.fetch(url.origin + '/requires-authentication');
			assert.equal(response.status, 200);
		});

		it('persists cookies through redirect chain', async () => {
			nock(url.origin)
				.post('/login')
				.reply(function () {
					return this.req.headers.cookie === 'user=zombie' ?
						[ 401, 'Unauthorized' ] :
						[ 302, 'Found', {
							'set-cookie': 'logged-in=1',
							'location': '/requires-authentication'
						} ];
				})
				.get('/requires-authentication')
				.reply(function () {
					assert.equal(this.req.headers.cookie, 'user=person; logged-in=1');
					return [ 200, 'OK' ];
				});

			const response = await browser.fetch(url.origin + '/login', {
				method: 'post',
				headers: { cookie: 'user=person' }
			});

			assert.equal(response.status, 200);
		});
	});

	describe('.load()', () => {
		it('loads document from string', async () => {
			const dom = await browser.load('<title>Document from string');
			assert(dom.window.document.title, 'Document from string');
		});

		it('loads document from response', async () => {
			nock(url.origin)
				.post('/secure')
				.reply((path, body) => {
					return body === 'password' ?
						[ 200, '<title>Welcome' ] :
						[ 401, '<title>Get out' ];
				});

			const response = await browser.fetch(url.origin + '/secure', {
				method: 'post',
				body: 'password'
			});

			assert.equal(response.status, 200);

			const dom = await browser.load(response);
			assert(dom.window.document.title, 'Welcome');
			assert.equal(dom.window.location.href, url.origin + '/secure');
		});

		it.skip('loads document with details from response', async () => {
			nock(url.origin)
				.get('/xml-document')
				.reply(
					200,
					'<xml><land><zombie /></land></xml>',
					{ 'content-type': 'application/xml' }
				);

			const pendingResponse = browser.fetch(url.origin + '/xml-document');
			const dom = await browser.load(pendingResponse);
			assert.equal(dom.window.location.href, url.origin + '/xml-document');
			// assert.equal(dom.window.document.contentType, 'application/xml');
		});
	});

	describe('.captureNavigation()', () => {
		describe('links', () => {
			let page;
			beforeEach('a page with a link', async () => {
				nock(url.origin)
					.get('/')
					.reply(200, '<a href="/about">About</a>');

				page = await browser.navigateTo(url.origin + '/');
			});

			it('captures navigation from link', async () => {
				const link = page.window.document.querySelector('a');
				assert.ok(link, 'expected link');

				const pendingRequest = browser.captureNavigation(page);
				assert(pendingRequest instanceof Promise, 'expected promise return value');

				link.click();

				const request = await pendingRequest;
				assert(request instanceof Request, 'expected request');
				assert.equal(request.url, link.href);
			});

			it('captures and follows navigation from link', async () => {
				nock(url.origin)
					.get('/about')
					.reply(200, '<title>About</title>');

				const link = page.window.document.querySelector('a');
				assert.ok(link, 'expected link');

				const pendingResponse = browser.captureNavigation(page, true);
				assert(pendingResponse instanceof Promise, 'expected promise return value');

				link.click();

				const response = await pendingResponse;
				assert(response instanceof Response, 'expected response');
				assert.equal(response.status, 200);

				const body = await response.text();
				assert.equal(body, '<title>About</title>');
			});

			it('fails on prevented navigation', async () => {
				const link = page.window.document.querySelector('a');
				assert.ok(link, 'expected link');

				link.addEventListener('click', event => event.preventDefault());

				const pendingRequest = browser.captureNavigation(page);
				link.click();

				await assert.rejects(pendingRequest, event => {
					assert.ok(event instanceof page.window.Event);
					assert.equal(event.type, 'click');
					assert.equal(event.target, link);
					return true;
				});
			});
		});

		describe('forms', () => {
			let page;
			beforeEach(async () => {
				nock(url.origin)
					.get('/')
					.times(2)
					.reply(function () {
						if (this.req.headers.cookie === 'logged-in=1') {
							return [ 200, '<title>Welcome</title>' ];
						}

						return [ 200, `
							<title>Log in</title>
							<form method="post" action="/login">
								<input type="text" name="username" />
								<input type="password" name="password" />
								<button type="submit">Log in</button>
							</form>
						` ];
					});

				page = await browser.navigateTo(url.origin + '/');
			});

			it('captures navigation from form', async () => {
				assert.equal(page.window.document.title, 'Log in');
				const [ form ] = page.window.document.forms;
				assert.ok(form, 'expected form');

				const [ username, password, submit ] = form.children;
				username.value = 'person';
				password.value = 'password';

				const pendingRequest = browser.captureNavigation(page);
				assert(pendingRequest instanceof Promise, 'expected promise return value');
				submit.click();

				const request = await pendingRequest;
				assert(request instanceof Request, 'expected request');
				assert.equal(request.method, 'POST');
				assert.equal(request.url, url.origin + '/login');
				assert.equal(request.headers.get('content-type'), 'application/x-www-form-urlencoded');
				assert(request.body instanceof ReadableStream);
			});

			it('captures navigation from form with submitter', async () => {
				assert.equal(page.window.document.title, 'Log in');
				const [ form ] = page.window.document.forms;
				assert.ok(form, 'expected form');

				const [ username, password, submit ] = form.children;
				username.value = 'person';
				password.value = 'password';

				const { method, action, enctype } = form;

				form.method = 'get';
				form.action = '/search';
				form.enctype = 'text/plain';

				submit.formMethod = method;
				submit.formAction = action;
				submit.formEnctype = enctype || 'application/x-www-form-urlencoded';

				const pendingRequest = browser.captureNavigation(page);
				submit.click();

				const request = await pendingRequest;
				assert.equal(request.method, 'POST');
				assert.equal(request.url, url.origin + '/login');
				assert.equal(request.headers.get('content-type'), 'application/x-www-form-urlencoded');
			});

			it('captures navigation from simple form', async () => {
				page = await browser.load(`
					<form action="/search">
						<input type="search" name="query" />
						<button>Search</button>
					</form>
				`, { url });
				const [ form ] = page.window.document.forms;
				assert.ok(form, 'expected form');

				const [ query, submit ] = form.children;
				query.value = 'Twinkies (not snowballs)';

				const pendingRequest = browser.captureNavigation(page);
				assert(pendingRequest instanceof Promise, 'expected promise return value');
				submit.click();

				const request = await pendingRequest;
				assert(request instanceof Request, 'expected request');
				assert.equal(request.method, 'GET');
				assert.equal(request.url, url.origin + '/search?query=Twinkies+%28not+snowballs%29');
				assert.equal(request.headers.get('content-type'), null);
			});

			it('captures and follows navigation from form', async () => {
				nock(url.origin)
					.post('/login')
					.reply(async function (path, body) {
						console.log(typeof body);
						const formData = await parseFormData(body, this.req.headers['content-type']);
						const loggedIn = formData.username === 'person' &&
							formData.password === 'password';

						return [ 303, undefined, {
							'location': '/',
							'set-cookie': 'logged-in=' + Number(loggedIn),
						} ];
					});

				assert.equal(page.window.document.title, 'Log in');
				const [ form ] = page.window.document.forms;
				assert.ok(form, 'expected form');

				const [ username, password, submit ] = form.children;
				username.value = 'person';
				password.value = 'password';

				const pendingResponse = browser.captureNavigation(page, true);
				assert(pendingResponse instanceof Promise, 'expected promise return value');
				submit.click();

				const response = await pendingResponse;
				assert(response instanceof Response, 'expected response');
				assert.equal(response.status, 200);

				const body = await response.text();
				assert.equal(body, '<title>Welcome</title>');
			});

			it('fails on invalid submit', async () => {
				assert.equal(page.window.document.title, 'Log in');
				const [ form ] = page.window.document.forms;
				assert.ok(form, 'expected form');

				form.addEventListener('submit', event => event.preventDefault());

				const [ username, password, submit ] = form.children;
				username.required = true;
				password.required = true;

				const pendingRequest = browser.captureNavigation(page);
				submit.click();

				await assert.rejects(pendingRequest, event => {
					assert.ok(event instanceof page.window.Event);
					assert.equal(event.type, 'invalid');
					assert.equal(event.target, username);
					return true;
				});
			});

			it('fails on prevented navigation', async () => {
				assert.equal(page.window.document.title, 'Log in');
				const [ form ] = page.window.document.forms;
				assert.ok(form, 'expected form');

				form.addEventListener('submit', event => event.preventDefault());

				const [ username, password, submit ] = form.children;
				username.value = 'person';
				password.value = 'password';

				const pendingRequest = browser.captureNavigation(page);
				submit.click();

				await assert.rejects(pendingRequest, event => {
					assert.ok(event instanceof page.window.Event);
					assert.equal(event.type, 'submit');
					assert.equal(event.target, form);
					assert.equal(event.defaultPrevented, true);
					return true;
				});
			});
		});
	});
});
