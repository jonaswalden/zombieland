import { increment, get } from './diamond-shared.mjs';
export function callB() { increment(); return get(); }
