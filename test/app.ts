import * as FunctionCurveEditor from "function-curve-editor";

const initialKnots: FunctionCurveEditor.Point[] = [
   {x: 0, y: 0.5 },
   {x: 1, y: 1   },
   {x: 2, y: 0.5 },
   {x: 3, y: 0.75},
   {x: 4, y: 0.25},
   {x: 5, y: 1   },
   {x: 6, y: -0.5},
   {x: 8, y: 0   } ];

const initialEditorState = <FunctionCurveEditor.EditorState>{
   knots:          initialKnots,
   planeOrigin:    {x: -1, y: -1.5},
   zoomFactorX:    800 / 10,
   zoomFactorY:    500 / 3,
   extendedDomain: true,
   relevantXMin:   -10,
   relevantXMax:   10,
   gridEnabled:    true };

function dumpFunctionValues (f: Function) {
   for (let x = -1; x < 10; x++) {
      console.log("f(" + x + ") = " + f(x)); }}

function toggleHelp() {
   const t = document.getElementById("helpText")!;
   if (t.classList.contains("hidden")) {
      t.classList.remove("hidden");
      t.innerHTML = FunctionCurveEditor.Widget.getFormattedHelpText(); }
    else {
      t.classList.add("hidden"); }}

function startup() {
   const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById("functionCurveEditor");
   const widget = new FunctionCurveEditor.Widget(canvas);
   widget.setEditorState(initialEditorState);
   widget.connectedCallback();
   widget.addEventListener("change", () => console.log("Change event"));
   document.getElementById("helpButton")!.addEventListener("click", toggleHelp);
   document.getElementById("dumpButton")!.addEventListener("click", () => dumpFunctionValues(widget.getFunction())); }

document.addEventListener("DOMContentLoaded", startup);
