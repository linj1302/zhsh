const path = require('path');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = {
    target: 'node',
    entry: './index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'main.js',
        clean: true
    },
    plugins: [
        new NodePolyfillPlugin()
    ],
    module: {
        rules: [
            {
                test: /\.js$/,
                loader: 'string-replace-loader',
                options: {
                    search: 'module = undefined',
                    replace: '',
                    flags: 'g'
                }
            },
            {
                test: /\.wasm$/,
                loader: 'url-loader',
                type: "javascript/auto",
                options: {limit: 8192, name: "[name].[ext]"},
            },
            {
                test: /\.ejs$/i,
                type: 'asset/source',
            }
        ]
    },
    //不压缩
    optimization: {
        minimize: false
    }
};