import nock from 'nock';

const httpVerbs = [ 'DELETE', 'GET', 'HEAD', 'MERGE', 'OPTIONS', 'PATCH', 'POST', 'PUT' ];

export default class ReverseProxy {
	#interceptors = [];

	constructor (proxyOrigin, upstreamOrigin, headers) {
		this.proxyOrigin = proxyOrigin;
		this.upstreamOrigin = upstreamOrigin;
		this.headers = headers ?
			new Headers(headers) :
			this.buildForwardingHeaders();

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

	buildForwardingHeaders () {
		console.log(this.proxyOrigin);
		const proxyOriginURL = new URL(this.proxyOrigin);
		const { protocol, host } = proxyOriginURL;
		const proto = protocol.slice(0, -1);
		return new Headers({
			'forwarded': `proto=${proto};host=${host}`,
			'x-forwarded-proto': proto,
			'x-forwarded-host': host,
		});
	}

	async #forward (req, path, body, callback) {
		try {
			const { method, headers: reqHeaders } = req;
			const headers = Object.fromEntries([
				...this.headers.entries(),
				...Object.entries(reqHeaders),
			]);

			const res = await fetch(new URL(path, this.upstreamOrigin), {
				method,
				headers,
				body: body || undefined,
			});
			callback(null, [
				res.status,
				await res.text(),
				Object.fromEntries(res.headers.entries())
			]);
		}
		catch (error) {
			callback(error);
		}
	}
};
