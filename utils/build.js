// Do this as the first thing so that any code reading it knows the right env.
process.env.NODE_ENV = 'production';
process.env.ASSET_PATH = '/';
process.env.MANIFEST_VERSION = process.env.MANIFEST_VERSION || '3';

var webpack = require('webpack'),
  config = require('../webpack.config');

delete config.chromeExtensionBoilerplate;

config.mode = 'production';

webpack(config, function (err) {
  if (err) throw err;
});
