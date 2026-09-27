import base from '../../eslint.config.js';
export default [...base, { ignores: ['.expo/**', 'android/**', 'ios/**', 'dist/**', 'metro.config.cjs'] }];
