import {UniFunction, InterpolationMethod, createInterpolatorWithFallback} from "commons-math-interpolation";
import EventTargetPolyfill from "./EventTargetPolyfill";
import * as DialogManager from "dialog-manager";

//--- Point and PointUtils -----------------------------------------------------

export interface Point {
   x: number;
   y: number; }

class PointUtils {

   public static clone (p: Point) : Point {
      return {x: p.x, y: p.y}; }

   // Returns the distance between two points.
   public static computeDistance (point1: Point, point2: Point) : number {
      const dx = point1.x - point2.x;
      const dy = point1.y - point2.y;
      return Math.sqrt(dx * dx + dy * dy); }

   public static computeCenter (point1: Point, point2: Point) : Point {
      return {x: (point1.x + point2.x) / 2, y: (point1.y + point2.y) / 2}; }

   // Returns the index of points1[pointIndex] in points2, or undefined.
   public static mapPointIndex (points1: Point[], points2: Point[], pointIndex: number | undefined) : number | undefined {
      if (pointIndex == undefined) {
         return; }
      const point = points1[pointIndex];
      return PointUtils.findPoint(points2, point); }

   // Returns the index of point in the points array or undefined.
   public static findPoint (points: Point[], point: Point) : number | undefined {
      if (!point) {
         return; }
      const i = points.indexOf(point);
      return (i >= 0) ? i : undefined; }

   public static makeXValsStrictMonotonic (points: Point[]) {
      for (let i = 1; i < points.length; i++) {
         if (points[i].x <= points[i - 1].x) {
            points[i].x = points[i - 1].x + 1E-6; }}}

   public static dumpPoints (points: Point[]) {
      for (let i = 0; i < points.length; i++) {
         console.log("[" + i + "] = (" + points[i].x + ", " + points[i].y + ")"); }}

   public static encodeCoordinateList (points: Point[]) : string {
      let s: string = "";
      for (const point of points) {
         if (s.length > 0) {
            s += ", "; }
         s += "[" + point.x + ", " + point.y + "]"; }
      return s; }

   public static decodeCoordinateList (s: string) : Point[] {
      const a = JSON.parse("[" + s + "]");
      const points: Point[] = Array(a.length);
      for (let i = 0; i < a.length; i++) {
         const e = a[i];
         if (!Array.isArray(e) || e.length != 2 || typeof e[0] != "number" || typeof e[1] != "number") {
            throw new Error("Invalid syntax in element " + i + "."); }
         points[i] = {x: e[0], y: e[1]}; }
      return points; }}

//--- Plotter ------------------------------------------------------------------

class FunctionPlotter {

   private wctx:             WidgetContext;
   private ctx:              CanvasRenderingContext2D;

   constructor (wctx: WidgetContext) {
      this.wctx = wctx;
      const ctx = wctx.canvas.getContext("2d");
      if (!ctx) {
         throw new Error("Canvas 2D context not available."); }
      this.ctx = ctx; }

   private clearCanvas() {
      const wctx = this.wctx;
      const ctx = this.ctx;
      ctx.save();
      const width  = wctx.canvas.width;
      const height = wctx.canvas.height;
      const xMin = (wctx.eState.relevantXMin != undefined) ? Math.max(0,    Math.min(width, wctx.mapLogicalToCanvasXCoordinate(wctx.eState.relevantXMin))) : 0;
      const xMax = (wctx.eState.relevantXMax != undefined) ? Math.max(xMin, Math.min(width, wctx.mapLogicalToCanvasXCoordinate(wctx.eState.relevantXMax))) : width;
      if (xMin > 0) {
         ctx.fillStyle = "#F8F8F8";
         ctx.fillRect(0, 0, xMin, height); }
      if (xMax > xMin) {
         ctx.fillStyle = "#FFFFFF";
         ctx.fillRect(xMin, 0, xMax - xMin, height); }
      if (xMax < width) {
         ctx.fillStyle = "#F8F8F8";
         ctx.fillRect(xMax, 0, width - xMax, height); }
      ctx.restore(); }

   private drawKnot (knotNdx: number) {
      const wctx = this.wctx;
      const ctx = this.ctx;
      const knot = wctx.eState.knots[knotNdx];
      const point = wctx.mapLogicalToCanvasCoordinates(knot);
      ctx.save();
      ctx.beginPath();
      const isDragging   = knotNdx == wctx.iState.selectedKnotNdx && wctx.iState.knotDragging;
      const isSelected   = knotNdx == wctx.iState.selectedKnotNdx;
      const isPotential  = knotNdx == wctx.iState.potentialKnotNdx;
      const bold = isDragging || isSelected || isPotential;
      const r = bold ? 5 : 4;
      ctx.arc(point.x, point.y, r, 0, 2 * Math.PI);
      ctx.lineWidth = bold ? 3 : 1;
      ctx.strokeStyle = (isDragging || isPotential) ? "#EE5500" : isSelected ? "#0080FF" : "#CC4444";
      ctx.stroke();
      ctx.restore(); }

   private drawKnots() {
      const knots = this.wctx.eState.knots;
      for (let knotNdx = 0; knotNdx < knots.length; knotNdx++) {
         this.drawKnot(knotNdx); }}

   private formatLabel (value: number, decPow: number) {
      let s = (decPow <= 7 && decPow >= -6) ? value.toFixed(Math.max(0, -decPow)) : value.toExponential();
      if (s.length > 10) {
         s = value.toPrecision(6); }
      return s; }

   private drawLabel (cPos: number, value: number, decPow: number, xy: boolean) {
      const wctx = this.wctx;
      const ctx = this.ctx;
      ctx.save();
      ctx.textBaseline = "bottom";
      ctx.font = "12px";
      ctx.fillStyle = "#707070";
      const x = xy ? cPos + 5 : 5;
      const y = xy ? wctx.canvas.height - 2 : cPos - 2;
      const s = this.formatLabel(value, decPow);
      ctx.fillText(s, x, y);
      ctx.restore(); }

   private drawGridLine (p: number, cPos: number, xy: boolean) {
      const wctx = this.wctx;
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = (p == 0) ? "#989898" : (p % 10 == 0) ? "#D4D4D4" : "#EEEEEE";
      ctx.fillRect(xy ? cPos : 0, xy ? 0 : cPos, xy ? 1 : wctx.canvas.width, xy ? wctx.canvas.height : 1);
      ctx.restore(); }

   private drawXYGrid (xy: boolean) {
      const wctx = this.wctx;
      const gp = wctx.getGridParms(xy);
      if (!gp) {
         return; }
      let p = gp.pos;
      let loopCtr = 0;
      while (true) {
         const lPos = p * gp.space;
         const cPos = xy ? wctx.mapLogicalToCanvasXCoordinate(lPos) : wctx.mapLogicalToCanvasYCoordinate(lPos);
         if (xy ? (cPos > wctx.canvas.width) : (cPos < 0)) {
            break; }
         this.drawGridLine(p, cPos, xy);
         this.drawLabel(cPos, lPos, gp.decPow, xy);
         p += gp.span;
         if (loopCtr++ > 100) {                            // to prevent endless loop on numerical instability
            break; }}}

   private drawGrid() {
      this.drawXYGrid(true);
      this.drawXYGrid(false); }

   private drawFunctionCurve (uniFunction: UniFunction, lxMin: number, lxMax: number) {
      const wctx = this.wctx;
      const ctx = this.ctx;
      ctx.save();
      ctx.beginPath();
      const cxMin = Math.max(0, Math.ceil(wctx.mapLogicalToCanvasXCoordinate(lxMin)));
      const cxMax = Math.min(wctx.canvas.width, Math.floor(wctx.mapLogicalToCanvasXCoordinate(lxMax)));
      for (let cx = cxMin; cx <= cxMax; cx++) {
         const lx = wctx.mapCanvasToLogicalXCoordinate(cx);
         const ly = uniFunction(lx);
         const cy = Math.max(-1E6, Math.min(1E6, wctx.mapLogicalToCanvasYCoordinate(ly)));
         ctx.lineTo(cx, cy); }
      ctx.strokeStyle = "#44CC44";
      ctx.stroke();
      ctx.restore(); }

   private drawFunctionCurveFromKnots() {
      const wctx = this.wctx;
      const knots = wctx.eState.knots;
      if (knots.length < 2 && !wctx.eState.extendedDomain) {
         return; }
      const xMin = wctx.eState.extendedDomain ? -1E99 : knots[0].x;
      const xMax = wctx.eState.extendedDomain ?  1E99 : knots[knots.length - 1].x;
      const uniFunction = wctx.createInterpolationFunction();
      this.drawFunctionCurve(uniFunction, xMin, xMax); }

   public paint() {
      const wctx = this.wctx;
      this.clearCanvas();
      if (wctx.eState.gridEnabled) {
         this.drawGrid(); }
      this.drawFunctionCurveFromKnots();
      this.drawKnots(); }}

//--- Pointer controller -------------------------------------------------------

// Controller for mouse and touch input.
class PointerController {

   private wctx:             WidgetContext;
   private pointers:         Map<number,PointerEvent>;     // maps IDs of active pointers to last pointer events
   private dragStartLPos:    Point | undefined;            // logical coordinates of starting point of drag action
   private dragStartCPos:    Point | undefined;            // canvas coordinates of starting point of drag action
   private dragCount:        number;
   private lastTouchTime:    number;
   private zooming:          boolean = false;
   private zoomLCenter:      Point;                        // zoom center point in logical coordinates
   private zoomStartDist:    number;
   private zoomStartFactorX: number;
   private zoomStartFactorY: number;
   private zoomX:            boolean;                      // true when zooming in X direction
   private zoomY:            boolean;                      // true when zooming in y direction

   constructor (wctx: WidgetContext) {
      this.wctx = wctx;
      this.pointers = new Map();
      wctx.canvas.addEventListener("pointerdown",   this.pointerDownEventListener);
      wctx.canvas.addEventListener("pointerup",     this.pointerUpEventListener);
      wctx.canvas.addEventListener("pointercancel", this.pointerUpEventListener);
      wctx.canvas.addEventListener("pointermove",   this.pointerMoveEventListener);
      wctx.canvas.addEventListener("dblclick",      this.dblClickEventListener);
      wctx.canvas.addEventListener("wheel",         this.wheelEventListener); }

   public dispose() {
      const wctx = this.wctx;
      wctx.canvas.removeEventListener("pointerdown",   this.pointerDownEventListener);
      wctx.canvas.removeEventListener("pointerup",     this.pointerUpEventListener);
      wctx.canvas.removeEventListener("pointercancel", this.pointerUpEventListener);
      wctx.canvas.removeEventListener("pointermove",   this.pointerMoveEventListener);
      wctx.canvas.removeEventListener("dblclick",      this.dblClickEventListener);
      wctx.canvas.removeEventListener("wheel",         this.wheelEventListener);
      this.releaseAllPointers(); }

   public processEscKey() {
      this.abortDragging(); }

   private pointerDownEventListener = (event: PointerEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || (event.pointerType == "mouse" && event.button != 0)) {
         return; }
      this.trackPointer(event);
      if ((event.pointerType == "touch" || event.pointerType == "pen") && this.pointers.size == 1) { // detect double-click with touch or pen
         if (this.lastTouchTime > 0 && performance.now() - this.lastTouchTime <= 300) { // double-click
            this.lastTouchTime = 0;
            this.processDoubleClickTouch();
            event.preventDefault();
            return; }
         this.lastTouchTime = performance.now(); }
      this.switchMode();
      event.preventDefault(); };

   private pointerUpEventListener = (event: PointerEvent) => {
      this.releasePointer(event.pointerId);
      this.switchMode();
      event.preventDefault(); };

   private switchMode() {
      const wctx = this.wctx;
      this.stopDragging();
      this.stopZooming();
      if (this.pointers.size == 1) {                       // left click or single touch
         this.startDragging();
         wctx.canvas.focus(); }
       else if (this.pointers.size == 2) {                 // zoom gesture
         this.startZooming(); }}

   private pointerMoveEventListener = (event: PointerEvent) => {
      if (!this.pointers.has(event.pointerId)) {
         this.updatePotentialKnot(event);
         return; }
      this.trackPointer(event);
      if (this.pointers.size == 1) {
         this.drag(); }
       else if (this.pointers.size == 2 && this.zooming) {
         this.zoom(); }
      event.preventDefault(); };

   private trackPointer (event: PointerEvent) {
      const wctx = this.wctx;
      const pointerId = event.pointerId;
      if (!this.pointers.has(pointerId)) {
         wctx.canvas.setPointerCapture(pointerId); }
      this.pointers.set(pointerId, event); }

   private releasePointer (pointerId: number) {
      const wctx = this.wctx;
      this.pointers.delete(pointerId);
      wctx.canvas.releasePointerCapture(pointerId); }

   private releaseAllPointers() {
      while (this.pointers.size > 0) {
         const pointerId = this.pointers.keys().next().value;
         this.releasePointer(pointerId); }}

   private startDragging() {
      const wctx = this.wctx;
      const cPoint = this.getCanvasCoordinates();
      const lPoint = wctx.mapCanvasToLogicalCoordinates(cPoint);
      const pointerType = this.pointers.values().next().value.pointerType;
      const knotNdx = this.findNearKnot(cPoint, pointerType);
      wctx.iState.selectedKnotNdx = knotNdx;
      wctx.iState.knotDragging = knotNdx != undefined;
      wctx.iState.planeDragging = knotNdx == undefined;
      this.dragStartLPos = lPoint;
      this.dragStartCPos = cPoint;
      this.dragCount = 0;
      wctx.iState.potentialKnotNdx = undefined;
      wctx.requestRefresh(); }

   private abortDragging() {
      const wctx = this.wctx;
      if (wctx.iState.knotDragging && this.dragCount > 0) {
         wctx.undo();
         wctx.fireChangeEvent(); }
      if (wctx.iState.planeDragging && this.dragStartCPos && this.dragStartLPos) {
         wctx.moveCoordinatePlane(this.dragStartCPos, this.dragStartLPos); }
      this.stopDragging();
      wctx.requestRefresh(); }

   private stopDragging() {
      const wctx = this.wctx;
      if (wctx.iState.knotDragging || wctx.iState.planeDragging) {
         wctx.requestRefresh(); }
      this.dragStartLPos = undefined;
      this.dragStartCPos = undefined;
      wctx.iState.knotDragging = false;
      wctx.iState.planeDragging = false; }

   private drag() {
      const wctx = this.wctx;
      const cPoint = this.getCanvasCoordinates();
      if (wctx.iState.knotDragging && wctx.iState.selectedKnotNdx != undefined) {
         if (this.dragCount++ == 0) {
            wctx.pushUndoHistoryState(); }
         const lPoint = wctx.mapCanvasToLogicalCoordinates(cPoint);
         const lPoint2 = this.snapToGrid(lPoint);
         wctx.moveKnot(wctx.iState.selectedKnotNdx, lPoint2);
         wctx.requestRefresh();
         wctx.fireChangeEvent(); }
       else if (wctx.iState.planeDragging && this.dragStartLPos) {
         wctx.moveCoordinatePlane(cPoint, this.dragStartLPos);
         wctx.requestRefresh(); }}

   private startZooming() {
      const wctx = this.wctx;
      const pointerValues = this.pointers.values();
      const event1 = pointerValues.next().value;
      const event2 = pointerValues.next().value;
      const cPoint1 = this.getCanvasCoordinatesFromEvent(event1);
      const cPoint2 = this.getCanvasCoordinatesFromEvent(event2);
      const cCenter = PointUtils.computeCenter(cPoint1, cPoint2);
      const xDist = Math.abs(cPoint1.x - cPoint2.x);
      const yDist = Math.abs(cPoint1.y - cPoint2.y);
      this.zoomLCenter = wctx.mapCanvasToLogicalCoordinates(cCenter);
      this.zoomStartDist = PointUtils.computeDistance(cPoint1, cPoint2);
      this.zoomStartFactorX = wctx.getZoomFactor(true);
      this.zoomStartFactorY = wctx.getZoomFactor(false);
      const t = Math.tan(Math.PI / 8);
      this.zoomX = xDist > t * yDist;
      this.zoomY = yDist > t * xDist;
      this.zooming = true; }

   private stopZooming() {
      this.zooming = false; }

   private zoom() {
      const wctx = this.wctx;
      const eState = wctx.eState;
      const pointerValues = this.pointers.values();
      const event1 = pointerValues.next().value;
      const event2 = pointerValues.next().value;
      const cPoint1 = this.getCanvasCoordinatesFromEvent(event1);
      const cPoint2 = this.getCanvasCoordinatesFromEvent(event2);
      const newCCenter = PointUtils.computeCenter(cPoint1, cPoint2);
      const newDist = PointUtils.computeDistance(cPoint1, cPoint2);
      const f = newDist / this.zoomStartDist;
      if (this.zoomX) {
         eState.xMax = eState.xMin + wctx.canvas.width / (this.zoomStartFactorX * f); }
      if (this.zoomY) {
         eState.yMax = eState.yMin + wctx.canvas.height / (this.zoomStartFactorY * f); }
      wctx.moveCoordinatePlane(newCCenter, this.zoomLCenter);
      wctx.requestRefresh(); }

   private wheelEventListener = (event: WheelEvent) => {
      const wctx = this.wctx;
      const cPoint = this.getCanvasCoordinatesFromEvent(event);
      if (event.deltaY == 0) {
         return; }
      const f = (event.deltaY > 0) ? Math.SQRT1_2 : Math.SQRT2;
      let zoomMode: ZoomMode;
      if (event.shiftKey) {
         zoomMode = ZoomMode.y; }
       else if (event.altKey) {
         zoomMode = ZoomMode.x; }
       else if (event.ctrlKey) {
         zoomMode = ZoomMode.xy; }
       else {
         zoomMode = wctx.eState.primaryZoomMode; }
      let fx: number;
      let fy: number;
      switch (zoomMode) {
         case ZoomMode.x: {
            fx = f; fy = 1; break; }
         case ZoomMode.y: {
            fx = 1; fy = f; break; }
         default: {
            fx = f; fy = f; }}
      wctx.zoom(fx, fy, cPoint);
      wctx.requestRefresh();
      event.preventDefault(); };

   private processDoubleClickTouch() {
      const cPoint = this.getCanvasCoordinates();
      this.createKnot(cPoint); }

   private dblClickEventListener = (event: MouseEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.button != 0) {
         return; }
      const cPoint = this.getCanvasCoordinatesFromEvent(event);
      this.createKnot(cPoint);
      event.preventDefault(); };

   private createKnot (cPoint: Point) {
      const wctx = this.wctx;
      wctx.pushUndoHistoryState();
      const lPoint = wctx.mapCanvasToLogicalCoordinates(cPoint);
      const knotNdx = wctx.addKnot(lPoint);
      wctx.iState.selectedKnotNdx = knotNdx;
      wctx.iState.potentialKnotNdx = knotNdx;
      wctx.iState.knotDragging = false;
      wctx.iState.planeDragging = false;
      wctx.requestRefresh();
      wctx.fireChangeEvent(); }

   private updatePotentialKnot (event: PointerEvent) {
      const wctx = this.wctx;
      const cPoint = this.getCanvasCoordinatesFromEvent(event);
      const knotNdx = this.findNearKnot(cPoint, event.pointerType);
      if (wctx.iState.potentialKnotNdx != knotNdx) {
        wctx.iState.potentialKnotNdx = knotNdx;
        wctx.requestRefresh(); }}

   private findNearKnot (cPoint: Point, pointerType: string) : number | undefined {
      const wctx = this.wctx;
      const r = wctx.findNearestKnot(cPoint);
      const proximityRange = (pointerType == "touch") ? 30 : 15;
      return (r && r.distance <= proximityRange) ? r.knotNdx : undefined; }

   private snapToGrid (lPoint: Point) : Point {
      const wctx = this.wctx;
      if (!wctx.eState.gridEnabled || !wctx.eState.snapToGridEnabled) {
         return lPoint; }
      return {x: this.snapToGrid2(lPoint.x, true), y: this.snapToGrid2(lPoint.y, false)}; }

   private snapToGrid2 (lPos: number, xy: boolean) {
      const maxDistance = 5;
      const wctx = this.wctx;
      const gp = wctx.getGridParms(xy);
      if (!gp) {
         return lPos; }
      const gridSpace = gp.space * gp.span;
      const gridPos = Math.round(lPos / gridSpace) * gridSpace;
      const lDist = Math.abs(lPos - gridPos);
      const cDist = lDist * wctx.getZoomFactor(xy);
      if (cDist > maxDistance) {
         return lPos; }
      return gridPos; }

   // Returns the coordinates of the first pointer.
   private getCanvasCoordinates() : Point {
      if (this.pointers.size < 1) {
         throw new Error("No active pointers."); }
      const event = this.pointers.values().next().value;
      return this.getCanvasCoordinatesFromEvent(event); }

   private getCanvasCoordinatesFromEvent (event: MouseEvent) : Point {
      const wctx = this.wctx;
      return wctx.mapViewportToCanvasCoordinates({x: event.clientX, y: event.clientY}); }}

//--- Keyboard controller ------------------------------------------------------

class KeyboardController {

   private wctx:             WidgetContext;

   constructor (wctx: WidgetContext) {
      this.wctx = wctx;
      wctx.canvas.addEventListener("keydown", this.keyDownEventListener);
      wctx.canvas.addEventListener("keypress", this.keyPressEventListener); }

   public dispose() {
      const wctx = this.wctx;
      wctx.canvas.removeEventListener("keydown", this.keyDownEventListener);
      wctx.canvas.removeEventListener("keypress", this.keyPressEventListener); }

   private keyDownEventListener = (event: KeyboardEvent) => {
      const keyName = genKeyName(event);
      if (this.processKeyDown(keyName)) {
         event.preventDefault(); }};

   private keyPressEventListener = (event: KeyboardEvent) => {
      const keyName = genKeyName(event);
      if (this.processKeyPress(keyName)) {
         event.preventDefault(); }};

   private processKeyDown (keyName: string) {
      const wctx = this.wctx;
      switch (keyName) {
         case "Backspace": case "Delete": {
            if (wctx.iState.selectedKnotNdx != undefined) {
               wctx.iState.knotDragging = false;
               wctx.pushUndoHistoryState();
               wctx.deleteKnot(wctx.iState.selectedKnotNdx);
               wctx.requestRefresh();
               wctx.fireChangeEvent(); }
            return true; }
         case "Ctrl+z": case "Alt+Backspace": {
            if (wctx.undo()) {
               wctx.requestRefresh();
               wctx.fireChangeEvent(); }
            return true; }
         case "Ctrl+y": case "Ctrl+Z": {
            if (wctx.redo()) {
               wctx.requestRefresh();
               wctx.fireChangeEvent(); }
            return true; }
         case "Escape": {
            wctx.pointerController.processEscKey();
            return true; }
         default: {
            return false; }}}

   private processKeyPress (keyName: string) {
      const wctx = this.wctx;
      const eState = wctx.eState;
      switch (keyName) {
         case "+": case "-": case "x": case "X": case "y": case "Y": {
            const fx = (keyName == '+' || keyName == 'X') ? Math.SQRT2 : (keyName == '-' || keyName == 'x') ? Math.SQRT1_2 : 1;
            const fy = (keyName == '+' || keyName == 'Y') ? Math.SQRT2 : (keyName == '-' || keyName == 'y') ? Math.SQRT1_2 : 1;
            wctx.zoom(fx, fy);
            wctx.requestRefresh();
            return true; }
         case "i": {
            wctx.reset();
            wctx.requestRefresh();
            wctx.fireChangeEvent();
            return true; }
         case "c": {
            wctx.pushUndoHistoryState();
            wctx.clearKnots();
            wctx.requestRefresh();
            wctx.fireChangeEvent();
            return true; }
         case "e": {
            eState.extendedDomain = !eState.extendedDomain;
            wctx.requestRefresh();
            return true; }
         case "g": {
            eState.gridEnabled = !eState.gridEnabled;
            wctx.requestRefresh();
            return true; }
         case "s": {
            eState.snapToGridEnabled = !eState.snapToGridEnabled;
            return true; }
         case "l": {
            eState.interpolationMethod = (eState.interpolationMethod == "linear") ? "akima" : "linear";
            wctx.requestRefresh();
            wctx.fireChangeEvent();
            return true; }
         case "k": {
            void this.promptKnots();
            return true; }
         case "r": {
            void this.resample1();
            return true; }
         default: {
            return false; }}}

   private async promptKnots() {
      const wctx = this.wctx;
      const eState = wctx.eState;
      const s1 = PointUtils.encodeCoordinateList(eState.knots);
      const s2 = await DialogManager.promptInput({promptText: "Knot coordinates:", defaultValue: s1, rows: 5});
      if (!s2 || s1 == s2) {
         return; }
      let newKnots: Point[];
      try {
         newKnots = PointUtils.decodeCoordinateList(s2); }
       catch (e) {
         await DialogManager.showMsg({titleText: "Error", msgText: "Input could not be decoded. " + e});
         return; }
      wctx.pushUndoHistoryState();
      wctx.replaceKnots(newKnots);
      wctx.requestRefresh();
      wctx.fireChangeEvent(); }

   private async resample1() {
      const n = await this.promptResampleCount();
      if (!n) {
         return; }
      this.resample2(n); }

   private resample2 (n: number) {
      const wctx = this.wctx;
      const oldKnots = wctx.eState.knots;
      if (oldKnots.length < 1) {
         void DialogManager.showMsg({msgText: "No knots."});
         return; }
      const xMin = oldKnots[0].x;
      const xMax = oldKnots[oldKnots.length - 1].x;
      const uniFunction = wctx.createInterpolationFunction();
      const newKnots: Point[] = Array(n);
      for (let i = 0; i < n; i++) {
         const x = xMin + (xMax - xMin) / (n - 1) * i;
         const y = uniFunction(x);
         newKnots[i] = {x, y}; }
      wctx.pushUndoHistoryState();
      wctx.replaceKnots(newKnots);
      wctx.requestRefresh();
      wctx.fireChangeEvent(); }

   private async promptResampleCount() {
      const wctx = this.wctx;
      const oldN = wctx.eState.knots.length;
      const s = await DialogManager.promptInput({titleText: "Re-sample", promptText: "Number of knots:", defaultValue: String(oldN)});
      if (!s) {
         return; }
      const n = Number(s);
      if (!Number.isInteger(n) || n < 2 || n > 1E7) {
         await DialogManager.showMsg({titleText: "Error", msgText: "Invalid number: " + s});
         return; }
      return n; }}

function genKeyName (event: KeyboardEvent) : string {
   const s =
      (event.altKey   ? "Alt+"   : "") +
      (event.ctrlKey  ? "Ctrl+"  : "") +
      (event.shiftKey && event.key.length > 1 ? "Shift+" : "") +
      (event.metaKey  ? "Meta+"  : "") +
      event.key;
   return s; }

//--- Internal widget context --------------------------------------------------

interface InteractionState {
   selectedKnotNdx:                    number | undefined;           // index of currently selected knot or undefined
   potentialKnotNdx:                   number | undefined;           // index of potential target knot for mouse click (or undefined)
   knotDragging:                       boolean;                      // true if the selected knot is beeing dragged
   planeDragging:                      boolean; }                    // true if the coordinate plane is beeing dragged

interface HistoryState {
   undoStack:                          Point[][];                    // old knot points
   undoStackPos:                       number; }                     // current position within undoStack
      // Concept:
      // - Only the knots are saved on the undo stack.
      // - If undoStackPos == undoStack.length, the current state has changed and is not equal to the last entry.
      // - If undoStackPos < undoStack.length, the current state is equal to undoStack[undoStackPos] and
      //   the entries > undoStackPos are redo states.

class WidgetContext {

   public plotter:                     FunctionPlotter;
   public pointerController:           PointerController;
   public kbController:                KeyboardController;

   public canvas:                      HTMLCanvasElement;            // the DOM canvas element
   public eventTarget:                 EventTarget;
   public isConnected:                 boolean;
   private animationFramePending:      boolean;

   public eState:                      EditorState;                  // current editor state
   public initialEState:               EditorState;                  // last set initial editor state
   public iState:                      InteractionState;
   public hState:                      HistoryState;

   constructor (canvas: HTMLCanvasElement) {
      this.canvas = canvas;
      this.eventTarget = new EventTargetPolyfill();
      this.isConnected = false;
      this.animationFramePending = false;
      this.setEditorState(<EditorState>{}); }

   public setConnected (connected: boolean) {
      if (connected == this.isConnected) {
         return; }
      if (connected) {
         this.plotter           = new FunctionPlotter(this);
         this.pointerController = new PointerController(this);
         this.kbController      = new KeyboardController(this); }
       else {
         this.pointerController.dispose();
         this.kbController.dispose(); }
      this.isConnected = connected;
      this.requestRefresh(); }

   public adjustBackingBitmapResolution() {
      this.canvas.width = this.canvas.clientWidth || 200;
      this.canvas.height = this.canvas.clientHeight || 200; }

   public setEditorState (eState: EditorState) {
      this.eState = cloneEditorState(eState);
      this.initialEState = cloneEditorState(eState);
      this.resetInteractionState();
      this.resetHistoryState();
      this.requestRefresh(); }

   public getEditorState() : EditorState {
      return cloneEditorState(this.eState); }

   private resetInteractionState() {
      this.iState = {
         selectedKnotNdx:  undefined,
         potentialKnotNdx: undefined,
         knotDragging:     false,
         planeDragging:    false}; }

   // Resets the context to the initial state.
   public reset() {
      this.setEditorState(this.initialEState); }

   public clearKnots() {
      this.eState.knots = Array();
      this.resetInteractionState(); }

   private resetHistoryState() {
      this.hState = {
         undoStack:    [],
         undoStackPos: 0 }; }

   // Must be called immediatelly before the current state (knots) is changed.
   public pushUndoHistoryState() {
      const hState = this.hState;
      hState.undoStack.length = hState.undoStackPos;                 // get rid of redo entries
      hState.undoStack.push(this.eState.knots.slice());              // push knots to undo stack
      hState.undoStackPos = hState.undoStack.length; }

   public undo() : boolean {
      const hState = this.hState;
      if (hState.undoStackPos < 1) {                                 // no more undo entries available
         return false; }
      if (hState.undoStackPos == hState.undoStack.length) {
         hState.undoStack.push(this.eState.knots.slice()); }
      hState.undoStackPos--;
      this.eState.knots = hState.undoStack[hState.undoStackPos].slice();
      this.resetInteractionState();
      return true; }

   public redo() : boolean {
      const hState = this.hState;
      if (hState.undoStackPos >= hState.undoStack.length - 1) {      // no more redo entries available
         return false; }
      hState.undoStackPos++;
      this.eState.knots = hState.undoStack[hState.undoStackPos].slice();
      this.resetInteractionState();
      return true; }

   public mapLogicalToCanvasXCoordinate (lx: number) : number {
      return (lx - this.eState.xMin) * this.canvas.width / (this.eState.xMax - this.eState.xMin); }

   public mapLogicalToCanvasYCoordinate (ly: number) : number {
      return this.canvas.height - (ly - this.eState.yMin) * this.canvas.height / (this.eState.yMax - this.eState.yMin); }

   public mapLogicalToCanvasCoordinates (lPoint: Point) : Point {
      return {x: this.mapLogicalToCanvasXCoordinate(lPoint.x), y: this.mapLogicalToCanvasYCoordinate(lPoint.y)}; }

   public mapCanvasToLogicalXCoordinate (cx: number) : number {
      return this.eState.xMin + cx * (this.eState.xMax - this.eState.xMin) / this.canvas.width; }

   public mapCanvasToLogicalYCoordinate (cy: number) : number {
      return this.eState.yMin + (this.canvas.height - cy) * (this.eState.yMax - this.eState.yMin) / this.canvas.height; }

   public mapCanvasToLogicalCoordinates (cPoint: Point) : Point {
      return {x: this.mapCanvasToLogicalXCoordinate(cPoint.x), y: this.mapCanvasToLogicalYCoordinate(cPoint.y)}; }

   public mapViewportToCanvasCoordinates (vPoint: Point) : Point {
      const rect = this.canvas.getBoundingClientRect();
      const x1 = vPoint.x - rect.left - (this.canvas.clientLeft || 0);
      const y1 = vPoint.y - rect.top  - (this.canvas.clientTop  || 0);
         // Our canvas element may have a border, but must have no padding.
         // In the future, the CSSOM View Module can probably be used for proper coordinate mapping.
      const x = x1 / this.canvas.clientWidth  * this.canvas.width;
      const y = y1 / this.canvas.clientHeight * this.canvas.height;
      return {x, y}; }

   // Moves the coordinate plane so that `cPoint` (in canvas coordinates) matches
   // `lPoint` (in logical coordinates), while keeping the zoom factors unchanged.
   public moveCoordinatePlane (cPoint: Point, lPoint: Point) {
      const eState = this.eState;
      const lWidth  = eState.xMax - eState.xMin;
      const lHeight = eState.yMax - eState.yMin;
      const cWidth  = this.canvas.width;
      const cHeight = this.canvas.height;
      eState.xMin = lPoint.x - cPoint.x * lWidth / cWidth;
      eState.xMax = eState.xMin + lWidth;
      eState.yMin = lPoint.y - (cHeight - cPoint.y) * lHeight / cHeight;
      eState.yMax = eState.yMin + lHeight; }

   public getZoomFactor (xy: boolean) : number {
      const eState = this.eState;
      return xy ? this.canvas.width / (eState.xMax - eState.xMin) : this.canvas.height / (eState.yMax - eState.yMin); }

   public zoom (fx: number, fyOpt?: number, cCenterOpt?: Point) {
      const eState = this.eState;
      const fy = (fyOpt != undefined) ? fyOpt : fx;
      const cCenter = cCenterOpt ? cCenterOpt : {x: this.canvas.width / 2, y: this.canvas.height / 2};
      const lCenter = this.mapCanvasToLogicalCoordinates(cCenter);
      eState.xMax = eState.xMin + (eState.xMax - eState.xMin) / fx;
      eState.yMax = eState.yMin + (eState.yMax - eState.yMin) / fy;
      this.moveCoordinatePlane(cCenter, lCenter); }

   public deleteKnot (knotNdx: number) {
      const knots = this.eState.knots;
      const oldKnots = knots.slice();
      knots.splice(knotNdx, 1);
      this.fixUpKnotIndexes(oldKnots); }

   public moveKnot (knotNdx: number, newPosition: Point) {
      this.eState.knots[knotNdx] = newPosition;
      this.revampKnots(); }

   // Returns the index of the newly inserted knot.
   public addKnot (newKnot: Point) : number {
      const knot = PointUtils.clone(newKnot);
      this.eState.knots.push(knot);
      this.revampKnots();
      const knotNdx = PointUtils.findPoint(this.eState.knots, knot);
        // (warning: This only works as long as makeXValsStrictMonotonic() modified the knots in-place and
        // does not construct new knot point objects)
      if (knotNdx == undefined) {
         throw new Error("Program logic error."); }
      return knotNdx; }

   public replaceKnots (newKnots: Point[]) {
      this.eState.knots = newKnots;
      this.resetInteractionState();
      this.revampKnots(); }

   private revampKnots() {
      this.sortKnots();
      PointUtils.makeXValsStrictMonotonic(this.eState.knots); }

   private sortKnots() {
      const oldKnots = this.eState.knots.slice();
      this.eState.knots.sort(function(p1: Point, p2: Point) {
         return (p1.x != p2.x) ? p1.x - p2.x : p1.y - p2.y; });
      this.fixUpKnotIndexes(oldKnots); }

   private fixUpKnotIndexes (oldKnots: Point[]) {
      this.iState.selectedKnotNdx  = PointUtils.mapPointIndex(oldKnots, this.eState.knots, this.iState.selectedKnotNdx);
      this.iState.potentialKnotNdx = PointUtils.mapPointIndex(oldKnots, this.eState.knots, this.iState.potentialKnotNdx);
      this.iState.knotDragging = this.iState.knotDragging && this.iState.selectedKnotNdx != undefined; }

   // Returns the index and distance of the nearest knot or undefined.
   public findNearestKnot (cPoint: Point) : {knotNdx: number; distance: number} | undefined {
      const knots = this.eState.knots;
      let minDist: number | undefined = undefined;
      let nearestKnotNdx: number | undefined = undefined;
      for (let i = 0; i < knots.length; i++) {
         const lKnot = knots[i];
         const cKnot = this.mapLogicalToCanvasCoordinates(lKnot);
         const d = PointUtils.computeDistance(cKnot, cPoint);
         if (minDist == undefined || d < minDist) {
            nearestKnotNdx = i;
            minDist = d; }}
      return (nearestKnotNdx != undefined) ? {knotNdx: nearestKnotNdx, distance: minDist!} : undefined; }

   public getGridParms (xy: boolean) : {space: number; span: number; pos: number; decPow: number} | undefined {
      const minSpaceC = xy ? 66 : 50;                                              // minimum space between grid lines in pixel
      const edge = xy ? this.eState.xMin : this.eState.yMin;                       // canvas edge coordinate
      const minSpaceL = minSpaceC / this.getZoomFactor(xy);                        // minimum space between grid lines in logical coordinate units
      const decPow = Math.ceil(Math.log(minSpaceL / 5) / Math.LN10);               // decimal power of grid line space
      const edgeDecPow = (edge == 0) ? -99 : Math.log(Math.abs(edge)) / Math.LN10; // decimal power of canvas coordinates
      if (edgeDecPow - decPow > 10) {
         return undefined; }                                                       // numerically instable
      const space = Math.pow(10, decPow);                                          // grid line space (distance) in logical units
      const f = minSpaceL / space;                                                 // minimum for span factor
      const span = (f > 2.001) ? 5 : (f > 1.001) ? 2 : 1;                          // span factor for visible grid lines
      const p1 = Math.ceil(edge / space);
      const pos = span * Math.ceil(p1 / span);                                     // position of first grid line in grid space units
      return {space, span, pos, decPow}; }

   public createInterpolationFunction() : UniFunction {
      const knots = this.eState.knots;
      const n = knots.length;
      const xVals = new Float64Array(n);
      const yVals = new Float64Array(n);
      for (let i = 0; i < n; i++) {
         xVals[i] = knots[i].x;
         yVals[i] = knots[i].y; }
      return createInterpolatorWithFallback(this.eState.interpolationMethod, xVals, yVals); }

   public requestRefresh() {
      if (this.animationFramePending || !this.isConnected) {
         return; }
      requestAnimationFrame(this.animationFrameHandler);
      this.animationFramePending = true; }

   private animationFrameHandler = () => {
      this.animationFramePending = false;
      if (!this.isConnected) {
         return; }
      this.refresh(); }

   // Re-paints the canvas and updates the cursor.
   private refresh() {
      this.plotter.paint();
      this.updateCanvasCursorStyle(); }

   private updateCanvasCursorStyle() {
      const style = (this.iState.knotDragging || this.iState.planeDragging) ? "move" : "auto";
      this.canvas.style.cursor = style; }

   public fireChangeEvent() {
      const event = new CustomEvent("change");
      this.eventTarget.dispatchEvent(event); }}

//--- Editor state -------------------------------------------------------------

export const enum ZoomMode {x, y, xy}
export {InterpolationMethod};

// Function curve editor state.
export interface EditorState {
   knots:                    Point[];                      // knot points for the interpolation
   xMin:                     number;                       // minimum x coordinate of the function graph area
   xMax:                     number;                       // maximum x coordinate of the function graph area
   yMin:                     number;                       // minimum y coordinate of the function graph area
   yMax:                     number;                       // maximum y coordinate of the function graph area
   extendedDomain:           boolean;                      // false = function domain is from first to last knot, true = function domain is extended
   relevantXMin?:            number | undefined;           // lower edge of relevant X range or undefined
   relevantXMax?:            number | undefined;           // upper edge of relevant X range or undefined
   gridEnabled:              boolean;                      // true to draw a coordinate grid
   snapToGridEnabled:        boolean;                      // true to enable snap to grid behavior
   interpolationMethod:      InterpolationMethod;          // optimal interpolation method
   primaryZoomMode:          ZoomMode; }                   // zoom mode to be used for mouse wheel when no shift/alt/ctrl-Key is pressed

// Clones and adds missing fields.
function cloneEditorState (eState: EditorState) : EditorState {
   const eState2 = <EditorState>{};
   eState2.knots               = (eState.knots ?? []).slice();
   eState2.xMin                = eState.xMin ?? 0;
   eState2.xMax                = eState.xMax ?? 1;
   eState2.yMin                = eState.yMin ?? 0;
   eState2.yMax                = eState.yMax ?? 1;
   eState2.extendedDomain      = eState.extendedDomain ?? true;
   eState2.relevantXMin        = eState.relevantXMin;
   eState2.relevantXMax        = eState.relevantXMax;
   eState2.gridEnabled         = eState.gridEnabled ?? true;
   eState2.snapToGridEnabled   = eState.snapToGridEnabled ?? true;
   eState2.interpolationMethod = eState.interpolationMethod ?? "akima";
   eState2.primaryZoomMode     = eState.primaryZoomMode ?? ZoomMode.xy;
   return eState2; }

//--- Widget -------------------------------------------------------------------

export class Widget {

   private wctx:             WidgetContext;

   constructor (canvas: HTMLCanvasElement, connected = true) {
      this.wctx = new WidgetContext(canvas);
      if (connected) {
         this.setConnected(true); }}

   // Sets a new EventTarget for this widget.
   // The web component calls this method to direct the events out of the shadow DOM.
   public setEventTarget (eventTarget: EventTarget) {
      this.wctx.eventTarget = eventTarget; }

   // Called after the widget is inserted into or removed from the DOM.
   // It installs or removes the internal event listeners for mouse, touch and keyboard.
   // When the widget is connected, it also adjusts the resolution of the backing bitmap
   // and draws the widget.
   public setConnected (connected: boolean) {
      const wctx = this.wctx;
      this.wctx.setConnected(connected);
      if (connected) {
         wctx.adjustBackingBitmapResolution(); }}

   // Registers an event listener.
   // Currently only the "change" event is supported.
   // The "change" event is fired after the user has changed the edited function
   // so that the function values are different. It is not fired when only the display
   // of the function has changed, e.g. by zooming or moving the plane.
   public addEventListener (type: string, listener: EventListener) {
      this.wctx.eventTarget.addEventListener(type, listener); }

   // Deregisters an event listener.
   public removeEventListener (type: string, listener: EventListener) {
      this.wctx.eventTarget.removeEventListener(type, listener); }

   // Returns the current state of the function curve editor.
   public getEditorState() : EditorState {
      return this.wctx.getEditorState(); }

   // Updates the current state of the function curve editor.
   public setEditorState (eState: EditorState) {
      const wctx = this.wctx;
      wctx.setEditorState(eState); }

   // Returns the current graph function.
   // The returned JavaScript function maps each x value to an y value.
   public getFunction() : (x: number) => number {
      return this.wctx.createInterpolationFunction(); }

   // Returns the help text as an array.
   public getRawHelpText() : string[] {
      const pz = this.wctx.eState.primaryZoomMode;
      const primaryZoomAxis = (pz == ZoomMode.x) ? "x-axis" : (pz == ZoomMode.y) ? "y-axis" : "both axes";
      return [
         "drag knot with mouse or touch",  "move a knot",
         "drag plane with mouse or touch", "move the coordinate space",
         "click or tap on knot",           "select a knot",
         "Delete / Backspace",             "delete the selected knot",
         "double-click or double-tap",     "create a new knot",
         "Esc",                            "abort moving",
         "Ctrl+Z / Alt+Backspace",         "undo",
         "Ctrl+Y / Ctrl+Shift+Z",          "redo",
         "mouse wheel",                    "zoom " + primaryZoomAxis,
         "shift + mouse wheel",            "zoom y-axis",
         "ctrl + mouse wheel",             "zoom both axes",
         "alt + mouse wheel",              "zoom x-axis",
         "touch zoom gesture",             "zoom x, y or both axes",
         "+ / -",                          "zoom both axes in/out",
         "X / x",                          "zoom x-axis in/out",
         "Y / y",                          "zoom y-axis in/out",
         "e",                              "toggle extended function domain",
         "g",                              "toggle coordinate grid",
         "s",                              "toggle snap to grid",
         "l",                              "toggle between linear interpolation and Akima",
         "k",                              "knots (display prompt with coordinate values)",
         "r",                              "re-sample knots",
         "c",                              "clear the canvas",
         "i",                              "reset to the initial state" ]; }

   // Returns the help text as a HTML string.
   public getFormattedHelpText() : string {
      const t = this.getRawHelpText();
      const a: string[] = [];
      a.push("<table class='functionCurveEditorHelp'>");
      a.push( "<colgroup>");
      a.push(  "<col class='functionCurveEditorHelpCol1'>");
      a.push(  "<col class='functionCurveEditorHelpCol2'>");
      a.push( "</colgroup>");
      a.push( "<tbody>");
      for (let i = 0; i < t.length; i += 2) {
         a.push("<tr><td>");
         a.push(t[i]);
         a.push("</td><td>");
         a.push(t[i + 1]);
         a.push("</td>"); }
      a.push( "</tbody>");
      a.push("</table>");
      return a.join(""); }}
