import alias from "rollup-plugin-alias";
import resolve from "rollup-plugin-node-resolve";

export default {
   input: "tempBuild/Main.js",
   output: {
      file: "app.js",
      format: "iife"
   },
   plugins: [
      resolve(),
      alias({
         "function-curve-editor": "../dist/FunctionCurveEditor.js"
      })
   ]
};
