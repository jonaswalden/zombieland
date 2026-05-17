import update, { memory as _helperMemory } from './helpers/update.mjs';
import component from './source-component/source-component.mjs';

update('source entry');
component();

export { _helperMemory };
