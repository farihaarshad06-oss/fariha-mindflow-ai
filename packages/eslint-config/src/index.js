import base from './base.js';
import { reactConfig } from './react.js';
import node from './node.js';
import nest from './nest.js';

export { base, reactConfig, node, nest };
export default [...base, ...reactConfig, ...node, ...nest];
