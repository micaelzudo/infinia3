module.exports = {
  target: ['esnext'],
  supported: {
    'bigint': true
  },
  format: 'esm',
  platform: 'browser',
  mainFields: ['module', 'main'],
  conditions: ['import', 'module', 'browser', 'default']
}; 