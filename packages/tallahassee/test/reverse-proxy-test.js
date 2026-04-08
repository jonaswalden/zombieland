import assert from 'node:assert/strict';
import Browser from '../browser.js';
import nock from 'nock';
import ReverseProxy from '../reverse-proxy.js';

describe('ReverseProxy', () => {
	before(() => nock.disableNetConnect());
	beforeEach(() => nock.cleanAll());
	after(() => nock.enableNetConnect());

	const proxyOrigin = 'https://tallahassee.zl';
	const upstreamOrigin = 'http://localhost';

	it('proxies request to upstream origin', async () => {
		nock(upstreamOrigin)
			.get('/resource')
			.reply(200, 'response from upstream');

		// eslint-disable-next-line no-new
		new ReverseProxy(proxyOrigin, upstreamOrigin);

		const response = await fetch(proxyOrigin + '/resource');
		assert.equal(response.status, 200);

		const responseBody = await response.text();
		assert.equal(responseBody, 'response from upstream');
	});

	it('proxies request with forwarding headers', async () => {
		nock(upstreamOrigin)
			.get('/resource')
			.reply(function () {
				const { headers } = this.req;
				assert.equal(headers.host, 'tallahassee.zl');
				assert.equal(headers.forwarded, 'proto=https;host=tallahassee.zl');
				assert.equal(headers['x-forwarded-proto'], 'https');
				assert.equal(headers['x-forwarded-host'], 'tallahassee.zl');
				assert.equal(headers['req-header'], 'value');
				return [ 200 ];
			});

		// eslint-disable-next-line no-new
		new ReverseProxy(proxyOrigin, upstreamOrigin);

		const response = await fetch(proxyOrigin + '/resource', {
			headers: { 'req-header': 'value' },
		});
		assert.equal(response.status, 200);
	});

	it('proxies request with additional headers', async () => {
		nock(upstreamOrigin)
			.get('/resource')
			.reply(function () {
				const { headers } = this.req;
				assert.equal(headers.host, 'tallahassee.zl');
				assert.equal(headers.via, '1.1 ZL');
				assert.equal(headers['req-header'], 'value');
				assert.equal(headers.forwarded, undefined);
				assert.equal(headers['x-forwarded-proto'], undefined);
				assert.equal(headers['x-forwarded-host'], undefined);
				return [ 200 ];
			});

		// eslint-disable-next-line no-new
		new ReverseProxy(proxyOrigin, upstreamOrigin, new Headers({
			via: '1.1 ZL'
		}));

		const response = await fetch(proxyOrigin + '/resource', {
			headers: { 'req-header': 'value' },
		});
		assert.equal(response.status, 200);
	});

	it('proxies modified request', async () => {
		nock(upstreamOrigin)
			.get('/resource')
			.reply(function () {
				const { headers } = this.req;
				assert.equal(headers.host, 'tallahassee.zl');
				assert.equal(headers.via, '1.1 ZL');
				assert.equal(headers['req-header'], 'value');
				assert.equal(headers.forwarded, 'for=192.168.0.1;proto=https;host=tallahassee.zl');
				assert.equal(headers['x-forwarded-proto'], undefined);
				assert.equal(headers['x-forwarded-host'], undefined);
				return [ 200 ];
			});

		class CustomReverseProxy extends ReverseProxy {
			modifyUpstreamRequest (req) {
				assert(!req.headers.get('forwarded'));

				req = super.modifyUpstreamRequest(req);
				assert(req.headers.get('forwarded'));

				req.headers.set('via', '1.1 ZL');
				req.headers.set('forwarded', 'for=192.168.0.1;' + req.headers.get('forwarded'));
				req.headers.delete('x-forwarded-proto');
				req.headers.delete('x-forwarded-host');
				return req;
			}
		}

		// eslint-disable-next-line no-new
		new CustomReverseProxy(proxyOrigin, upstreamOrigin);

		const response = await fetch(proxyOrigin + '/resource', {
			headers: { 'req-header': 'value' },
		});
		assert.equal(response.status, 200);
	});

	it('proxies request with body', async () => {
		nock(upstreamOrigin)
			.post('/resource')
			.reply((path, body) => {
				assert.equal(body, 'request body');
				return [ 200 ];
			});

		// eslint-disable-next-line no-new
		new ReverseProxy(proxyOrigin, upstreamOrigin);

		const response = await fetch(proxyOrigin + '/resource', {
			method: 'post',
			body: 'request body',
		});
		assert.equal(response.status, 200);
	});

	[
		'DELETE',
		'GET',
		'HEAD',
		'MERGE',
		'OPTIONS',
		'PATCH',
		'POST',
		'PUT'
	].forEach(method => {
		it(`proxies request with method ${method}`, async () => {
			nock(upstreamOrigin)
				.intercept('/resource', method)
				.reply(200);

			// eslint-disable-next-line no-new
			new ReverseProxy(proxyOrigin, upstreamOrigin);

			const response = await fetch(proxyOrigin + '/resource', { method });
			assert.equal(response.status, 200);
		});
	});

	it('proxies requests until cleared', async () => {
		nock(upstreamOrigin)
			.get('/resource')
			.reply(200)
			.persist();

		const proxy = new ReverseProxy(proxyOrigin, upstreamOrigin);

		for (let i = 0; i < 3; i++) {
			const response = await fetch(proxyOrigin + '/resource');
			assert.equal(response.status, 200);
		}

		proxy.clear();

		await assert.rejects(fetch(proxyOrigin + '/resource'));

		const upstreamResponse = await fetch(upstreamOrigin + '/resource');
		assert.equal(upstreamResponse.status, 200);
	});

	it('proxies requests from browser, document and web page', async () => {
		nock(upstreamOrigin)
			.get('/document')
			.reply(200, `
				<!doctype html>
				<title>Document from upstream</title>
				<iframe src="/sub-document"></iframe>
				<script>
					const req = new XMLHttpRequest();
					req.open("GET", "/data");
					req.addEventListener("load", function () {
						const data = JSON.parse(this.responseText);
						document.title += ', ' + data.title;
						window.dispatchEvent(new Event("fetchresponse"));
					});
					req.send();
				</script>
			`)
			.get('/sub-document')
			.reply(200, `
				<!doctype html>
				<title>Sub-document from upstream</title>
			`)
			.get('/data')
			.reply(200, { title: 'Data from upstream' });

		// eslint-disable-next-line no-new
		new ReverseProxy(proxyOrigin, upstreamOrigin);
		const browser = new Browser(proxyOrigin);
		const dom = await browser.navigateTo('/document', {}, {
			resources: 'usable',
			runScripts: 'dangerously',
		});
		await Promise.all([
			new Promise(r => dom.window.addEventListener('load', r)),
			new Promise(r => dom.window.addEventListener('fetchresponse', r)),
		]);

		assert.equal(dom.window.location.href, proxyOrigin + '/document');
		assert.equal(dom.window.document.title, 'Document from upstream, Data from upstream');
		assert.equal(dom.window.frames[0].document.title, 'Sub-document from upstream');
	});
});
