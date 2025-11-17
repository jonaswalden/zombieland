import assert from 'node:assert/strict';
import server from './server.js';
import setup from '../helpers/setup.js';
import { Browser, Painter, Stylesheet, Script, CustomResourceLoader } from '../../zombieland.js';

class ResourceLoader extends CustomResourceLoader {
	load (url) {
		if (url.endsWith('/stylesheet.css'))
			return new Stylesheet({ h1: { height: 1000 } });
		if (url.endsWith('/script.js'))
			return new Script(url, 'console.log("!", document.querySelector("h1").offsetHeight)');
	}
}

Feature('resources', () => {
	const pendingServerOrigin = setup(server);

	let resourceLoader;
	Given('a resource loader', () => {
		resourceLoader = new ResourceLoader();
	});

	let serverOrigin, dom;
	When('load page', async () => {
		serverOrigin = await pendingServerOrigin;
		dom = await new Browser(serverOrigin)
			.navigateTo('/', {}, {
				resources: resourceLoader,
				runScripts: 'dangerously',
				painter: new Painter(),
			});
	});

	Then('resources are loaded', () => {

	});
});
