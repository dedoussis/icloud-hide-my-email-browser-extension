// This script is responsible for creating a production build of the extension.
// It configures and runs webpack to bundle the code.

// Set the proper environment variables for a production build.
// NODE_ENV is set to 'production' to enable optimizations in webpack and other libraries.
// ASSET_PATH is set to '/' to ensure assets are loaded correctly from the root.
// MANIFEST_VERSION is set to '3' by default, which is the latest version of the Chrome extension manifest.
process.env.NODE_ENV = 'production';
process.env.ASSET_PATH = '/';
process.env.MANIFEST_VERSION = process.env.MANIFEST_VERSION || '3';

var webpack = require('webpack'),
  config = require('../webpack.config');

// The 'chromeExtensionBoilerplate' object in the webpack config is used for development-specific settings,
// such as the web server configuration. It's not needed for production builds, so we delete it here.
delete config.chromeExtensionBoilerplate;

// Set the webpack mode to 'production'. This tells webpack to use its built-in optimizations for production,
// such as minification and tree shaking.
config.mode = 'production';

// Run webpack with the production configuration.
webpack(config, function (err, stats) {
  // A fatal error occurred during the webpack build (e.g., a configuration error).
  // We log the error and its details, and then exit with a non-zero status code
  // to indicate that the build has failed. This is crucial for CI environments.
  if (err) {
    console.error(err.stack || err);
    if (err.details) {
      console.error(err.details);
    }
    process.exit(1);
  }

  // The build process has completed, but there might be compilation warnings or errors.
  if (stats) {
    // Extract only the warnings and errors from the stats object to keep the output clean.
    var info = stats.toJson({ all: false, warnings: true, errors: true });

    // If there are any warnings, log them to the console.
    // Warnings do not typically fail the build, but they should be reviewed.
    if (stats.hasWarnings()) {
      info.warnings.forEach(function (warning) {
        console.warn(warning.message || warning);
      });
    }

    // If there are any errors, log them to the console and exit with a non-zero status code.
    // This will cause the build to fail, which is the desired behavior when the code doesn't compile correctly.
    if (stats.hasErrors()) {
      info.errors.forEach(function (error) {
        console.error(error.message || error);
      });
      process.exit(1);
    }

    // If the build is successful (no fatal errors and no compilation errors),
    // log the webpack stats to the console. The output is formatted to be readable,
    // with colors if the terminal supports it.
    console.log(
      stats.toString({
        colors: process.stdout.isTTY,
        chunks: false,
        modules: false,
      })
    );
  }
});
