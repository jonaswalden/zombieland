import { increment, get } from './diamond-shared.mjs';
export function callA() { increment(); return get(); }
