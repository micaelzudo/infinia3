const esbuild = require('esbuild');

const bigIntPlugin = {
  name: 'bigint-transform',
  setup(build) {
    build.onLoad({ filter: /\.js$/ }, async (args) => {
      const contents = await require('fs').promises.readFile(args.path, 'utf8');
      const transformed = contents.replace(/(\d+)n/g, 'BigInt("$1")');
      return { contents: transformed, loader: 'js' };
    });
  },
};

module.exports = bigIntPlugin; 