const path = require("path");
const { merge } = require("webpack-merge");
const base = require("./webpack.base.config");

// const HtmlWebpackPlugin = require('html-webpack-plugin');



module.exports = env => {
  return merge(base(env), {
    entry: {
      main: "./src/main.js",
      app: "./src/app.js"
    },
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, "../app")
    },
    // plugins: [new HtmlWebpackPlugin()]
  });
};
