import { createRequire } from 'module';

// @ts-nocheck
const require$1 = createRequire(import.meta.url);
let binding;
try {
    binding = require$1("../build/Debug/wrtc.node");
}
catch (error) {
    binding = require$1("../build/Release/wrtc.node");
}
var binding$1 = binding;

export { binding$1 as default };
//# sourceMappingURL=binding.js.map
