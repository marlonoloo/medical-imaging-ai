const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    classifier: './src/classifier.ts',
    detector: './src/detector.ts',
    segmentor: './src/segmentor.ts'
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    fallback: {
      fs: false,
      path: require.resolve('path-browserify'),
    },
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html',
      chunks: []
    }),
    new HtmlWebpackPlugin({
      template: './public/classifier.html',
      filename: 'classifier/index.html',
      chunks: ['classifier']
    }),
    new HtmlWebpackPlugin({
      template: './public/detector.html',
      filename: 'detector/index.html',
      chunks: ['detector']
    }),
    new HtmlWebpackPlugin({
      template: './public/segmentor.html',
      filename: 'segmentor/index.html',
      chunks: ['segmentor']
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    port: 3000,
    historyApiFallback: {
      rewrites: [
        { from: /^\/classifier/, to: '/classifier/index.html' },
        { from: /^\/detector/, to: '/detector/index.html' },
        { from: /^\/segmentor/, to: '/segmentor/index.html' },
        { from: /./, to: '/index.html' }
      ]
    }
  },
};
