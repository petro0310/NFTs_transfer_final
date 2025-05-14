const webpack = require('webpack');

module.exports = function override(config) {
  // Add fallbacks for Node.js core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    assert: require.resolve('assert/'),
    stream: require.resolve('stream-browserify'),
    crypto: require.resolve('crypto-browserify'),
    buffer: require.resolve('buffer/'),
    process: require.resolve('process/browser.js'),
    fs: false,
    path: false,
    os: false
  };

  // Add plugins
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser.js'
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env': JSON.stringify(process.env)
    })
  ];

  // Ignore specific problematic modules
  config.resolve.alias = {
    ...config.resolve.alias,
    '@solana/spl-token-metadata': false
  };

  // Add module rules for handling process/browser
  config.module.rules.push({
    test: /\.m?js/,
    resolve: {
      fullySpecified: false
    }
  });

  return config;
}; 