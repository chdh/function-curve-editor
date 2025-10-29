import * as FunctionCurveEditor from "function-curve-editor";

let widget: FunctionCurveEditor.Widget;

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
   xMin:           -1,
   xMax:           9,
   yMin:           -1.5,
   yMax:           1.5,
   extendedDomain: true,
   relevantXMin:   -10,
   relevantXMax:   10,
   gridEnabled:    true,
   customPaintFunction };

function dumpFunctionValues (f: Function) {
   for (let x = -1; x < 10; x++) {
      console.log("f(" + x + ") = " + f(x)); }}

function toggleHelp() {
   const t = document.getElementById("helpText")!;
   if (t.classList.contains("hidden")) {
      t.classList.remove("hidden");
      t.innerHTML = widget.getFormattedHelpText(); }
    else {
      t.classList.add("hidden"); }}

function drawSpiral (centerX: number, centerY: number, widthX: number, widthY: number, growthFactor: number, revolutions: number, w0: number, pctx: FunctionCurveEditor.CustomPaintContext) {
   const ctx = pctx.ctx;
   ctx.save();
   ctx.strokeStyle = "#800080";
   ctx.beginPath();
   for (let w = 0; w < revolutions * 2 * Math.PI; w += 0.02) {
      const g = growthFactor ** (w / (2 * Math.PI));
      const lx = centerX + g * Math.cos(w0 + w) * widthX;
      const ly = centerY + g * Math.sin(w0 + w) * widthY;
      const cx = pctx.mapLogicalToCanvasXCoordinate(lx);
      const cy = pctx.mapLogicalToCanvasYCoordinate(ly);
      ctx.lineTo(cx, cy); }
   ctx.stroke();
   ctx.restore(); }

function customPaintFunction (pctx: FunctionCurveEditor.CustomPaintContext) {
   switch (pctx.pass) {
      case 1: drawSpiral(1.5, -0.75, 0.5, 0.25, 0.6, 8, 0, pctx); break;
      case 2: drawSpiral(2.5, -0.75, 0.5, 0.25, 0.6, 8, Math.PI, pctx); break;
      }}

function startup2() {
   const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById("functionCurveEditor");
   widget = new FunctionCurveEditor.Widget(canvas);
   widget.setEditorState(initialEditorState);
   widget.addEventListener("change", () => console.log("Change event"));
   document.getElementById("helpButton")!.addEventListener("click", toggleHelp);
   document.getElementById("dumpButton")!.addEventListener("click", () => dumpFunctionValues(widget.getFunction())); }

function startup() {
   try {
      startup2(); }
    catch (e) {
      console.log(e);
      alert("Error: " + e); }}

document.addEventListener("DOMContentLoaded", startup);
