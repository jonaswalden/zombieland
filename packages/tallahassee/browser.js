import jsdom from 'jsdom';

export default class Browser {
	constructor (origin, cookieJar) {
		this.origin = origin;
		this.cookieJar = cookieJar || new jsdom.CookieJar();
	}

	async navigateTo (resource, fetchOptions, loadOptions) {
		const response = this.fetch(resource, fetchOptions);
		return this.load(response, loadOptions);
	}

	async fetch (resource, options = {}) {
		resource = typeof resource === 'string' ? new URL(resource, this.origin) : resource;
		const isRequest = resource instanceof Request;
		const request = isRequest ? resource : new Request(resource, {
			...options,
			redirect: 'manual'
		});

		this.#persistCookies(request.url, request.headers);
		request.headers.delete('cookie');
		request.headers.set('cookie', this.cookieJar.getCookieStringSync(request.url));

		const response = await fetch(request);

		this.#persistCookies(response.url, null, response.headers);

		if (![ 301, 302, 303, 307, 308 ].includes(response.status))
			return response;

		const redirectOptions = { ...options, headers: undefined };
		if (response.status <= 303) {
			delete redirectOptions.method;
			delete redirectOptions.body;
		}

		return this.fetch(response.headers.get('location'), redirectOptions);
	}

	async load (resource, options = {}) {
		resource = await resource;
		const isResponse = resource instanceof Response;
		const document = isResponse ? await resource.text() : resource;

		return new jsdom.JSDOM(document, {
			pretendToBeVisual: Boolean(options?.painter),
			runScripts: options.resources && 'outside-only',
			...options,
			...(isResponse && {
				url: resource.url || undefined,
				contentType: resource.headers.get('content-type') || undefined,
			}),
			cookieJar: this.cookieJar,
			beforeParse: window => {
				options.painter?.beforeParse(window);
				options.resources?.beforeParse?.(window);
				options.beforeParse?.(window);
			}
		});
	}

	captureNavigation (dom, follow) {
		const browser = this;

		return new Promise((resolve, reject) => {
			dom.window.addEventListener('click', captureLinkClick);
			dom.window.addEventListener('submit', captureFormSubmit);
			for (const form of dom.window.document.forms)
				for (const element of form.elements)
					element.addEventListener('invalid', captureFormElementInvalid);

			function captureLinkClick (event) {
				const link = event.target.closest('a');
				if (!link) return;

				runDefault(event, link.href);
			}

			function captureFormSubmit (event) {
				const form = event.target;
				const submitter = event.submitter;
				const method = submitter?.formMethod || form.method;
				const action = new URL(submitter?.formAction || form.action);
				const body = new FormData();
				for (const [ key, value ] of new dom.window.FormData(form, submitter)) {
					body.append(key, value);
				}

				if (method === 'post') {
					const enctype = submitter?.formEnctype || form.enctype;

					return runDefault(event, action, {
						method,
						headers: { 'content-type': enctype },
						body,
					});
				}

				for (const [ key, value ] of body) {
					action.searchParams.set(key, value);
				}

				runDefault(event, action);
			}

			function captureFormElementInvalid (event) {
				cleanUp();
				return reject(event);
			}

			function runDefault (event, url, options) {
				cleanUp();
				if (event.defaultPrevented) {
					return reject(event);
				}

				event.preventDefault();
				if (!follow) {
					return resolve(new Request(url, options));
				}

				dom.window.dispatchEvent(new dom.window.Event('pagehide'));
				dom.window.close();
				resolve(browser.fetch(url, options));
			}

			function cleanUp () {
				dom.window.removeEventListener('click', captureLinkClick);
				dom.window.removeEventListener('submit', captureFormSubmit);
				for (const form of dom.window.document.forms)
					for (const element of form.elements)
						element.removeEventListener('invalid', captureFormElementInvalid);
			}
		});
	}

	#persistCookies (url, reqHeaders, resHeaders) {
		let directives;
		if (reqHeaders)
			directives = reqHeaders.get('cookie')
				?.split(';')
				.map(d => d.trim())
				.filter(Boolean);
		else if (resHeaders)
			directives = resHeaders.getSetCookie();

		for (const directive of directives || []) {
			this.cookieJar.setCookieSync(directive, url);
		}
	}
};
