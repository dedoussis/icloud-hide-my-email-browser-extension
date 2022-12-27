const webpack = require('webpack'),
  path = require('path'),
  pick = require('lodash.pick'),
  env = require('./utils/env'),
  CopyWebpackPlugin = require('copy-webpack-plugin'),
  HtmlWebpackPlugin = require('html-webpack-plugin'),
  TerserPlugin = require('terser-webpack-plugin'),
  MiniCssExtractPlugin = require('mini-css-extract-plugin'),
  ASSET_PATH = process.env.ASSET_PATH || '/',
  MANIFEST_VERSION = parseInt(process.env.MANIFEST_VERSION || '3');

const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const isDev = process.env.NODE_ENV !== 'production';

const fileExtensions = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'eot',
  'otf',
  'svg',
  'ttf',
  'woff',
  'woff2',
];

const makeManifestV2 = (mv3) => {
  const transformedV3Keys = [
    'manifest_version',
    'background',
    'action',
    'permissions',
    'host_permissions',
    'options_page',
    'declarative_net_request',
  ];
  const commonKeys = Object.keys(mv3).filter(
    (k) => !transformedV3Keys.includes(k)
  );
  const innerJoin = pick(mv3, commonKeys);

  return {
    ...innerJoin,
    manifest_version: 2,
    background: { scripts: [mv3.background.service_worker] },
    browser_action: mv3.action,
    browser_specific_settings: {
      gecko: {
        ...(isDev ? { id: 'id@temporary-addon' } : {}),
        strict_min_version: '88.0',
      },
    },
    options_ui: {
      page: mv3.options_page,
    },
    permissions: [
      ...mv3.host_permissions,
      ...mv3.permissions.filter((p) => p !== 'declarativeNetRequest'),
      'webRequest',
      'webRequestBlocking',
    ],
  };
};

const options = {
  mode: isDev ? 'production' : 'development',
  entry: {
    popup: path.join(__dirname, 'src', 'pages', 'Popup', 'index.tsx'),
    background: path.join(__dirname, 'src', 'pages', 'Background', 'index.ts'),
    contentScript: path.join(__dirname, 'src', 'pages', 'Content', 'index.ts'),
    options: path.join(__dirname, 'src', 'pages', 'Options', 'index.tsx'),
  },
  chromeExtensionBoilerplate: {
    notHotReload: ['background', 'contentScript'],
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'build'),
    clean: true,
    publicPath: ASSET_PATH,
  },
  module: {
    rules: [
      {
        // look for .css or .scss files
        test: /\.(css|scss)$/,
        // in the `src` directory
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
          },
          {
            loader: 'css-loader',
          },
          {
            loader: 'postcss-loader',
          },
          {
            loader: 'sass-loader',
            options: {
              sourceMap: true,
            },
          },
        ],
      },
      {
        test: new RegExp('.(' + fileExtensions.join('|') + ')$'),
        type: 'asset/resource',
        exclude: /node_modules/,
        // loader: 'file-loader',
        // options: {
        //   name: '[name].[ext]',
        // },
      },
      {
        test: /\.html$/,
        loader: 'html-loader',
        exclude: /node_modules/,
      },
      { test: /\.(ts|tsx)$/, loader: 'ts-loader', exclude: /node_modules/ },
    ],
  },
  resolve: {
    extensions: fileExtensions
      .map((extension) => '.' + extension)
      .concat(['.js', '.jsx', '.ts', '.tsx', '.css']),
  },
  plugins: [
    new MiniCssExtractPlugin(),
    new CleanWebpackPlugin({ verbose: false }),
    new webpack.ProgressPlugin(),
    // expose and write the allowed env vars on the compiled bundle
    new webpack.EnvironmentPlugin(['NODE_ENV']),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/manifest.json',
          to: path.join(__dirname, 'build'),
          force: true,
          transform: function (content) {
            // generates the manifest file using the package.json information
            const mv3 = JSON.parse(content.toString());
            const manifest = MANIFEST_VERSION === 3 ? mv3 : makeManifestV2(mv3);

            return Buffer.from(
              JSON.stringify({
                version: process.env.npm_package_version,
                ...manifest,
              })
            );
          },
        },
        {
          from: 'src/rules.json',
          to: path.join(__dirname, 'build'),
          force: true,
        },
        {
          from: 'src/assets/img/icon-128.png',
          to: path.join(__dirname, 'build'),
          force: true,
        },
        {
          from: 'src/assets/img/icon-48.png',
          to: path.join(__dirname, 'build'),
          force: true,
        },
        {
          from: 'src/assets/img/icon-32.png',
          to: path.join(__dirname, 'build'),
          force: true,
        },
        {
          from: 'src/assets/img/icon-16.png',
          to: path.join(__dirname, 'build'),
          force: true,
        },
      ],
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src', 'pages', 'Popup', 'index.html'),
      filename: 'popup.html',
      chunks: ['popup'],
      cache: false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src', 'pages', 'Options', 'index.html'),
      filename: 'options.html',
      chunks: ['options'],
      cache: false,
    }),
  ],
  infrastructureLogging: {
    level: 'info',
  },
};

if (env.NODE_ENV === 'development') {
  options.devtool = 'cheap-module-source-map';
} else {
  options.optimization = {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
    ],
  };
}

module.exports = options;
