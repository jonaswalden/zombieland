'use strict';

const jsdom = require('jsdom');

module.exports = class Browser {
	constructor (origin, cookieJar) {
		this.origin = origin;
		this.cookieJar = cookieJar || new jsdom.CookieJar();
	}

	async navigateTo (url, headers, jsdomConfig = {}) {
		const response = this.fetch(url, headers && { headers });
		return this.load(response, jsdomConfig);
	}

	async fetch (url, options = {}) {
		url = new URL(url, this.origin);

		const headers = new Headers(options.headers);
		this.#persistCookies(url, headers);
		headers.delete('cookie');
		headers.set('cookie', this.cookieJar.getCookieStringSync(url.href));

		const response = await fetch(url, { ...options, headers, redirect: 'manual' });

		this.#persistCookies(response.url || url, null, response.headers);

		if (![ 301, 302, 303, 307, 308 ].includes(response.status))
			return response;

		const redirectOptions = { ...options, headers: undefined };
		if (response.status <= 303) {
			delete redirectOptions.method;
			delete redirectOptions.body;
		}

		return this.fetch(response.headers.get('location'), redirectOptions);
	}

	async load (pendingResponse, jsdomConfig = {}) {
		const response = await pendingResponse;
		const isResponse = response instanceof Response;
		const document = isResponse ? await response.text() : response;

		return new jsdom.JSDOM(document, {
			runScripts: 'outside-only',
			...jsdomConfig,
			...(isResponse && {
				url: response.url || undefined,
				contentType: response.headers.get('content-type') || undefined,
			}),
			cookieJar: this.cookieJar,
			beforeParse: window => {
				jsdomConfig.resources?.beforeParse?.(window);
				jsdomConfig.painter?.beforeParse(window);
				jsdomConfig.beforeParse?.(window);
			}
		});
	}

	#persistCookies (url, reqHeaders, resHeaders) {
		let directives;
		if (reqHeaders)
			directives = reqHeaders.get('cookie')?.split(/;\s*/).filter(Boolean);
		else if (resHeaders)
			directives = resHeaders.getSetCookie();

		for (const directive of directives || []) {
			this.cookieJar.setCookieSync(directive, url.href || url);
		}
	}
};
