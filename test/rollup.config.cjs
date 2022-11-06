const alias = require("@rollup/plugin-alias");
const resolve = require("@rollup/plugin-node-resolve");

module.exports = {
   input: "tempBuild/Main.js",
   output: {
      file: "app.js",
      format: "iife"
   },
   plugins: [
      resolve(),
      alias({
         entries: {
            "function-curve-editor": "../dist/FunctionCurveEditor.js"
         }
      })
   ]
};
