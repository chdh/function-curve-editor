import alias from "rollup-plugin-alias";
import resolve from "rollup-plugin-node-resolve";

export default {
   input: "tempBuild/app.js",
   output: {
      file: "tempBuild/appBundle.js",
      format: "iife"
   },
   plugins: [
      resolve(),
      alias({
         "function-curve-editor": "../dist/FunctionCurveEditor.js"
      })
   ]
};
