import { Browser, BrowserContext } from 'happy-dom';
import CookieStringUtility from 'happy-dom/lib/cookie/urilities/CookieStringUtility.js';

[
	[ 'navigateTo', browserContextNavigateTo ],
	[ 'fetch', browserContextFetch ],
	[ 'load', browserContextLoad ],
	[ 'captureNavigation', browserContextCaptureNavigation ]
].forEach(([ name, method ]) => {
	Browser.prototype[name] = function () {
		return this.defaultContext[name](...arguments);
	};
	BrowserContext.prototype[name] = method;
});

export default Browser;

async function browserContextNavigateTo (resource, fetchOptions, loadOptions) {
	const response = this.fetch(resource, fetchOptions);
	return this.load(response, loadOptions);
}

async function browserContextFetch (resource, options = {}) {
	resource = typeof resource === 'string' ? new URL(resource, this.origin) : resource;
	const isRequest = resource instanceof Request;
	const request = isRequest ? resource : new Request(resource, {
		...options,
		redirect: 'manual'
	});

	console.log(resource.href, options.body && Object.fromEntries(options.body.entries()));
	persistCookies(this.cookieContainer, request);
	request.headers.delete('cookie');
	const cookies = this.cookieContainer.getCookies(new URL(request.url));
	const cookieString = CookieStringUtility.cookiesToString(cookies);

	request.headers.set('cookie', cookieString);

	const response = await fetch(request);
	persistCookies(this.cookieContainer, response);

	if (![ 301, 302, 303, 307, 308 ].includes(response.status))
		return response;

	const redirectOptions = { ...options, headers: undefined };
	if (response.status <= 303) {
		delete redirectOptions.method;
		delete redirectOptions.body;
	}

	const locationURL = new URL(response.headers.get('location'), response.url);
	return this.fetch(locationURL, redirectOptions);
}

async function browserContextLoad (resource, options = {}) {
	resource = await resource;
	const isResponse = resource instanceof Response;
	const document = isResponse ? await resource.text() : resource;

	const page = this.newPage();
	page.url = resource.url || options.url || undefined;
	page.content = document;
	return page.mainFrame;

	// return new jsdom.JSDOM(document, {
	// 	pretendToBeVisual: Boolean(options?.painter),
	// 	runScripts: options.resources && 'outside-only',
	// 	...options,
	// 	...(isResponse && {
	// 		url: resource.url || undefined,
	// 		contentType: resource.headers.get('content-type') || undefined,
	// 	}),
	// 	cookieJar: this.cookieJar,
	// 	beforeParse: window => {
	// 		options.painter?.beforeParse(window);
	// 		options.resources?.beforeParse?.(window);
	// 		options.beforeParse?.(window);
	// 	}
	// });
}


function persistCookies (cookieContainer, resource) {
	const { url: href, headers } = resource;
	const url = new URL(href);
	let directives;
	if (resource instanceof Request)
		directives = headers.get('cookie')
			?.split(';')
			.map(d => d.trim())
			.filter(Boolean);
	else if (resource instanceof Response)
		directives = headers.getSetCookie();

	if (!directives?.length) return;

	const cookies = directives?.map(d => CookieStringUtility.stringToCookie(url, d));
	cookieContainer.addCookies(cookies);
}

function browserContextCaptureNavigation (page, follow) {
	const browserContext = this;

	return new Promise((resolve, reject) => {
		page.window.addEventListener('click', captureLinkClick);
		page.window.addEventListener('submit', captureFormSubmit);
		for (const form of page.window.document.forms)
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
			const action = new URL(submitter?.getAttribute('formaction') || form.action, page.window.location.origin);
			const body = new page.window.FormData(form, submitter);
			console.log(method, body);

			if (method === 'post') {
				const enctype = submitter?.formEnctype || form.enctype || 'application/x-www-form-urlencoded';
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

			page.window.dispatchEvent(new page.window.Event('pagehide'));
			page.window.close();

			resolve(browserContext.fetch(url, options));
		}

		function cleanUp () {
			page.window.removeEventListener('click', captureLinkClick);
			page.window.removeEventListener('submit', captureFormSubmit);
			for (const form of page.window.document.forms)
				for (const element of form.elements)
					element.removeEventListener('invalid', captureFormElementInvalid);
		}
	});
}
