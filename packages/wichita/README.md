# Wichita

A resource module for running client side JS and resolving assets.

JSDOM does run scripts quite well. It does however not provide a controlled way to execute scripts at a _convenient time_. A pattern when testing something is asserting an element original state, running the scripts then asserting the element's new state. JSDOM will, like a browser, run any client script as soon as it has loaded making it _tricky_ to run assertions prior to script execution.

Custom script executor enables running code at any given time. Also it enables running source code over a built resource which is good for rapid retesting.

Resolver enables "binding" script tags to files making the test suite less verbose and less prone to mistakes.

## Table of Contents

- [Basic usage](#basic-usage)
- [API](#api)
  - [Script](#script)
    - [new Script(filePath)](#new-scriptfilepath)
    - [new Script(code)](#new-scriptcode)
    - [new Script(identifier, code)](#new-scriptidentifier-code)
    - [script.evaluate(context)](#scriptevaluatecontext)
  - [ResourceLoader](#resourceloader)
    - [new ResourceLoader([options, ...args])](#new-resourceloaderoptions-args)
    - [resourceLoader.runScripts(dom[, options])](#resourceloaderrunscriptsdom-options)

## Basic usage

```js
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { Script } from '@zombieland/wichita';

const dom = new JSDOM('<title>initial value</title>');
const script = new Script(`
  document.title += ', edit from script';
`);

await script.evaluate(dom.window);

assert.equal(dom.window.document.title, 'initial value, edit from script');
```

## API

### `Script`

A module for executing JavaScript code. A wrapper around the [`vm.SourceTextModule`](https://nodejs.org/docs/latest/api/vm.html#class-vmsourcetextmodule). Requires the use of the `--experimental-vm-modules` command flag.

```js
import { Script } from '@zombieland/wichita';
```
Or if you're using the `Script` module without JSDOM:

```js
import Script from '@zombieland/wichita/script.js';
```

#### `new Script(filePath)`

Creates a new Script instance from a file path.

- `filePath` `<string>` Absolute path to a JavaScript file

```js
const script = new Script(import.meta.dirname + '/my-script.js');
```

#### `new Script(code)`

Creates a new Script instance from source code.

- `code` `<string>` JavaScript code to execute

```js
const script = new Script(`
  document.title += ', edit from script';
`);
```

#### `new Script(identifier, code)`

Creates a new Script instance with a custom identifier from source code.

- `identifier` `<string>` Script identifier. Used for resolving imports and stack traces.
- `code` `<string>` JavaScript code to execute

```js
const script = new Script('custom-script.js', `
	document.title += ', edit from named script';
`);
```

#### `script.evaluate(context)`

Executes the script in the provided context with ES module support.

- `context` `<Object>` Context object to be used as the global scope for script execution
- Returns: `<Promise>` Fulfills with exported values from the script (if any)

```js
it('evaluates code in a given context', async () => {
  const dom = new JSDOM('<title>initial value</title>');
  const script = new Script(`
    document.title += ', edit from script';
  `);
  
  await script.evaluate(dom.window);

  assert.equal(dom.window.document.title, 'initial value, edit from script');
});

it('evaluates code with imports', async () => {
  const dom = new JSDOM('<title>initial value</title>');
  const script = new Script('./source-entry.js');
  
  await script.evaluate(dom.window);

  assert.equal(dom.window.document.title, 'initial value, edit from source entry, edit from source component');
});

it('evaluates code with exports', async () => {
  const dom = new JSDOM('<title>with exports</title>');
  const script = new Script(`
    export default document.title + '?';
    export const named = document.title + '!';
  `);
  
  const exports = await script.evaluate(dom.window);

  assert.equal(exports.default, 'with exports?');
  assert.equal(exports.named, 'with exports!');
});

it('evaluates code multiple times', async () => {
  const dom1 = new JSDOM('<title>once</title>');
  const dom2 = new JSDOM('<title>twice</title>');
  const script = new Script(`
    let i = 0;
    export default document.title + '!';
    export const times = ++i;
  `);

  const exports = await Promise.all([
    script.evaluate(dom1.window),
    script.evaluate(dom2.window),
  ]);
  
  assert.equal(exports[0].default, 'once!');
  assert.equal(exports[1].default, 'twice!');
  assert.equal(exports[1].times, 1);
});
```

### `ResourceLoader`

An extension of the jsdom [`ResourceLoader`](https://github.com/jsdom/jsdom/blob/main/README.md#advanced-configuration) with additional support for resolving DOM nodes into wichita scripts and script execution.

> May be subject to change in the future. Keeping documentation breif. Take a look in the [Source code resource example](https://github.com/BonnierNews/zombieland/blob/main/examples/source-code-resource) for more details.

```js
import { ResourceLoader } from '@zombieland/wichita';
```

#### `new ResourceLoader([options, ...args])`

Creates a new ResourceLoader instance.

- `options` `<Object>`
	- `resolveTag` Function to resolve a HTMLScriptElement into path to a local file to execute
- `args` Arguments to forward to jsdom `ResourceLoader` constructor
	
#### `resourceLoader.runScripts(dom[, options])`

Iterates through document script tags and evaluates code with `Script`. Uses the `resolveTag` function to resolve script element into arguments for `Script` constructor.

- `dom` `<JSDOM>` DOM to execute scripts in
- `options` `<Object>`
	- `noModule` `Boolean` When set to `true` will skip `script[module]`. **Default:** `false`
- Returns: `<Promise>` Resolves with `undefined`

```js
it('runs document scripts', async () => {
	const resourceLoader = new ResourceLoader();
  const dom = new JSDOM(
	  '<script src="/scripts/main.js"></script>', 
	  { resources: resourceLoader, runScripts: "outside-only" }
  );
  await resourceLoader.runScripts();
});

it('runs local source code', async () => {
	const resourceLoader = new ResourceLoader({
		resolveTag (script) {
			if (script.src.endsWith('/scripts/main.js')) {
				const localSourceCodeFile = import.meta.resolve(path.join(import.meta.dirname, '../src/scripts/main.js'));
				return localSourceCodeFile;
			}
		}
	});
  const dom = new JSDOM(
	  '<script src="/scripts/main.js"></script>', 
	  { resources: resourceLoader, runScripts: "outside-only" }
  );
  await resourceLoader.runScripts();
});
```

## Todo

- [ ] Not using the ES module feature mustn't require the `--experimental-vm-modules` flag.
- [ ] VM evaluation based on script `type` attribute.
- [ ] Respecting `nomodule` like modern / legacy browser.
- [ ] Support for importing CJS modules in Script
- [x] Expose Script exports
- [x] Cache for FS operations.
- [x] Have not been able to make a working example using `fetch` along with [the community recommended polyfill](https://github.com/jsdom/jsdom/issues/1724#issuecomment-720727999). Did make it with another polyfill though :fingers_crossed:
