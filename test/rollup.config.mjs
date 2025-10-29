import Path from "node:path";
import alias from '@rollup/plugin-alias';
import {nodeResolve} from '@rollup/plugin-node-resolve';

export default {
   input: "tempBuild/Main.js",
   output: {
      file: "app.js",
      format: "iife"
   },
   plugins: [
      nodeResolve(),
      alias({
         entries: {
            "function-curve-editor": Path.resolve("../dist/FunctionCurveEditor.js")
         }
      })
   ]
}
