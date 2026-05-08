import { callA } from './diamond-a.mjs';
import { callB } from './diamond-b.mjs';
globalThis.results = [ callA(), callB(), callA() ];
