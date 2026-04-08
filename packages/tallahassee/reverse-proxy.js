import nock from 'nock';

const httpVerbs = [ 'DELETE', 'GET', 'HEAD', 'MERGE', 'OPTIONS', 'PATCH', 'POST', 'PUT' ];

export default class ReverseProxy {
	#interceptors = [];

	constructor (proxyOrigin, upstreamOrigin, headers) {
		this.proxyOrigin = proxyOrigin;
		this.upstreamOrigin = upstreamOrigin;
		this.headers = new Headers(headers || (url => {
			const { protocol, hostname } = url;
			const proto = protocol.slice(0, -1);
			return {
				'forwarded': `proto=${proto};host=${hostname}`,
				'x-forwarded-proto': proto,
				'x-forwarded-host': hostname,
			};
		})(new URL(proxyOrigin)));

		const proxy = this;
		for (const verb of httpVerbs) {
			const interceptor = nock(proxyOrigin)
				.persist()
				.intercept(/.*/, verb);
			interceptor.reply(function (path, body, callback) {
				proxy.#forward.call(proxy, this.req, path, body, callback);
			});
			this.#interceptors.push(interceptor);
		}
	}

	clear () {
		for (const interceptor of this.#interceptors)
			nock.removeInterceptor(interceptor);
	}

	modifyUpstreamRequest (req) {
		for (const [ key, value ] of this.headers.entries())
			req.headers.set(key, value);
		return req;
	}

	async #forward (req, path, body, callback) {
		try {
			const { method, headers } = req;
			const bereq = this.modifyUpstreamRequest(
				new Request(new URL(path, this.upstreamOrigin), {
					method,
					headers,
					body: body || undefined,
				})
			);
			const beres = await fetch(bereq);
			callback(null, [
				beres.status,
				await beres.text(),
				Object.fromEntries(beres.headers.entries())
			]);
		}
		catch (error) {
			callback(error);
		}
	}
};
