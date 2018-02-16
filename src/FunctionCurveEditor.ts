import {UniFunction, createAkimaSplineInterpolator, createCubicSplineInterpolator, createLinearInterpolator} from "commons-math-interpolation";

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

   // Returns the index of points1[pointIndex] in points2, or null.
   public static mapPointIndex (points1: Point[], points2: Point[], pointIndex: number | null) : number | null {
      if (pointIndex == null) {
         return null; }
      const point = points1[pointIndex];
      return PointUtils.findPoint(points2, point); }

   // Returns the index of point in the points array or null.
   public static findPoint (points: Point[], point: Point) : number | null {
      if (point == null) {
         return null; }
      const i = points.indexOf(point);
      return (i >= 0) ? i : null; }

   public static makeXValsStrictMonotonic (points: Point[]) {
      for (let i = 1; i < points.length; i++) {
         if (points[i].x <= points[i - 1].x) {
            points[i].x = points[i - 1].x + 1E-6; }}}

   public static dumpPoints (points: Point[]) {
      for (let i = 0; i < points.length; i++) {
         console.log("[" + i + "] = (" + points[i].x + ", " + points[i].y + ")"); }}

   public static encodeCoordinateList (points: Point[]) : string {
      let s: string = "";
      for (let point of points) {
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
      if (ctx == null) {
         throw new Error("Canvas 2D context not available."); }
      this.ctx = ctx; }

   private clearCanvas() {
      const wctx = this.wctx;
      const ctx = this.ctx;
      ctx.save();
      const width  = wctx.canvas.width;
      const height = wctx.canvas.height;
      const xMin = (wctx.eState.relevantXMin != null) ? Math.max(0,    Math.min(width, wctx.mapLogicalToCanvasXCoordinate(wctx.eState.relevantXMin))) : 0;
      const xMax = (wctx.eState.relevantXMax != null) ? Math.max(xMin, Math.min(width, wctx.mapLogicalToCanvasXCoordinate(wctx.eState.relevantXMax))) : width;
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
      if (gp == null) {
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

// Common high-level routines for mouse and touch.
class PointerController {

   private wctx:             WidgetContext;
   private proximityRange:   number;
   private dragStartPos:     Point | null;                 // logical coordinates of starting point of drag action

   constructor (wctx: WidgetContext, proximityRange: number) {
      this.wctx = wctx;
      this.proximityRange = proximityRange; }

   public startDragging (cPoint: Point) {
      const wctx = this.wctx;
      const lPoint = wctx.mapCanvasToLogicalCoordinates(cPoint);
      const knotNdx = this.findNearKnot(cPoint);
      wctx.iState.selectedKnotNdx = knotNdx;
      wctx.iState.knotDragging = knotNdx != null;
      wctx.iState.planeDragging = knotNdx == null;
      this.dragStartPos = lPoint;
      wctx.iState.potentialKnotNdx = null;
      wctx.refresh(); }

   public processPointerMove (cPoint: Point) : boolean {
      const wctx = this.wctx;
      if (wctx.iState.knotDragging && wctx.iState.selectedKnotNdx != null) {
         const lPoint = wctx.mapCanvasToLogicalCoordinates(cPoint);
         const lPoint2 = this.snapToGrid(lPoint);
         wctx.moveKnot(wctx.iState.selectedKnotNdx, lPoint2);
         wctx.refresh();
         wctx.fireChangeEvent();
         return true; }
       else if (wctx.iState.planeDragging && this.dragStartPos != null) {
         wctx.adjustPlaneOrigin(cPoint, this.dragStartPos);
         wctx.refresh();
         return true; }
       else {
         const knotNdx = this.findNearKnot(cPoint);
         if (wctx.iState.potentialKnotNdx != knotNdx) {
           wctx.iState.potentialKnotNdx = knotNdx;
           wctx.refresh(); }}
      return false; }

   public stopDragging() : boolean {
      const wctx = this.wctx;
      if (!wctx.iState.knotDragging && !wctx.iState.planeDragging) {
         return false; }
      wctx.iState.knotDragging = false;
      wctx.iState.planeDragging = false;
      this.dragStartPos = null;
      wctx.refresh();
      return true; }

   public createKnot (cPoint: Point) {
      const wctx = this.wctx;
      const lPoint = wctx.mapCanvasToLogicalCoordinates(cPoint);
      const knotNdx = wctx.addKnot(lPoint);
      wctx.iState.selectedKnotNdx = knotNdx;
      wctx.iState.potentialKnotNdx = knotNdx;
      wctx.iState.knotDragging = false;
      wctx.iState.planeDragging = false;
      wctx.refresh();
      wctx.fireChangeEvent(); }

   private findNearKnot (cPoint: Point) : number | null {
      const wctx = this.wctx;
      const r = wctx.findNearestKnot(cPoint)
      return (r != null && r.distance <= this.proximityRange) ? r.knotNdx : null; }

   private snapToGrid (lPoint: Point) : Point {
      const wctx = this.wctx;
      if (!wctx.eState.gridEnabled || !wctx.eState.snapToGridEnabled) {
         return lPoint; }
      return {x: this.snapToGrid2(lPoint.x, true), y: this.snapToGrid2(lPoint.y, false)}; }

   private snapToGrid2 (lPos: number, xy: boolean) {
      const maxDistance = 5;
      const wctx = this.wctx;
      let gp = wctx.getGridParms(xy);
      if (gp == null) {
         return lPos; }
      const gridSpace = gp.space * gp.span;
      const gridPos = Math.round(lPos / gridSpace) * gridSpace;
      const lDist = Math.abs(lPos - gridPos);
      const cDist = lDist * wctx.getZoomFactor(xy);
      if (cDist > maxDistance) {
         return lPos; }
      return gridPos; }}

//--- Mouse controller ---------------------------------------------------------

class MouseController {

   private wctx:              WidgetContext;
   private pointerController: PointerController;

   constructor (wctx: WidgetContext) {
      this.wctx = wctx;
      this.pointerController = new PointerController(wctx, 15);
      wctx.canvas.addEventListener("mousedown", this.mouseDownEventListener);
      document.addEventListener("mouseup", this.mouseUpEventListener);
      document.addEventListener("mousemove", this.mouseMoveEventListener);
      wctx.canvas.addEventListener("dblclick", this.dblClickEventListener);
      wctx.canvas.addEventListener("wheel", this.wheelEventListener); }

   public dispose() {
      const wctx = this.wctx;
      wctx.canvas.removeEventListener("mousedown", this.mouseDownEventListener);
      document.removeEventListener("mouseup", this.mouseUpEventListener);
      document.removeEventListener("mousemove", this.mouseMoveEventListener);
      wctx.canvas.removeEventListener("dblclick", this.dblClickEventListener);
      wctx.canvas.removeEventListener("wheel", this.wheelEventListener); }

   private mouseDownEventListener = (event: MouseEvent) => {
      const wctx = this.wctx;
      if (event.which == 1) {
         const cPoint = this.getCanvasCoordinatesFromEvent(event);
         this.pointerController.startDragging(cPoint);
         event.preventDefault();
         wctx.canvas.focus(); }};

   private mouseUpEventListener = (event: MouseEvent) => {
      if (this.pointerController.stopDragging()) {
         event.preventDefault(); }};

   private mouseMoveEventListener = (event: MouseEvent) => {
      const cPoint = this.getCanvasCoordinatesFromEvent(event);
      if (this.pointerController.processPointerMove(cPoint)) {
         event.preventDefault(); }};

   private dblClickEventListener = (event: MouseEvent) => {
      if (event.which == 1) {
         const cPoint = this.getCanvasCoordinatesFromEvent(event);
         this.pointerController.createKnot(cPoint);
         event.preventDefault(); }};

   private wheelEventListener = (event: WheelEvent) => {
      const wctx = this.wctx;
      const cPoint = this.getCanvasCoordinatesFromEvent(event);
      if (event.deltaY == 0) {
         return; }
      const f = (event.deltaY > 0) ? Math.SQRT1_2 : Math.SQRT2;
      let fx: number;
      let fy: number;
      if (event.shiftKey) {
         fx = f;
         fy = 1; }
       else if (event.altKey || event.ctrlKey) {
         fx = 1;
         fy = f; }
       else {
         fx = f;
         fy = f; }
      wctx.zoom(fx, fy, cPoint);
      wctx.refresh();
      event.preventDefault(); };

   private getCanvasCoordinatesFromEvent (event: MouseEvent) : Point {
      const wctx = this.wctx;
      return wctx.mapViewportToCanvasCoordinates({x: event.clientX, y: event.clientY}); }}

//--- Touch controller ---------------------------------------------------------

class TouchController {

   private wctx:             WidgetContext;
   private pointerController: PointerController;
   private lastTouchTime:    number;
   private zooming:          boolean;
   private zoomLCenter:      Point;
   private zoomStartDist:    number;
   private zoomStartFactorX: number;
   private zoomStartFactorY: number;
   private zoomX:            boolean;
   private zoomY:            boolean;

   constructor (wctx: WidgetContext) {
      this.wctx = wctx;
      this.pointerController = new PointerController(wctx, 30);
      wctx.canvas.addEventListener("touchstart", this.touchStartEventListener);
      wctx.canvas.addEventListener("touchmove", this.touchMoveEventListener);
      wctx.canvas.addEventListener("touchend", this.touchEndEventListener);
      wctx.canvas.addEventListener("touchcancel", this.touchEndEventListener); }

   public dispose() {
      const wctx = this.wctx;
      wctx.canvas.removeEventListener("touchstart", this.touchStartEventListener);
      wctx.canvas.removeEventListener("touchmove", this.touchMoveEventListener);
      wctx.canvas.removeEventListener("touchend", this.touchEndEventListener);
      wctx.canvas.removeEventListener("touchcancel", this.touchEndEventListener); }

   private touchStartEventListener = (event: TouchEvent) => {
      const touches = event.touches;
      if (touches.length == 1) {
         const touch = touches[0];
         let cPoint = this.getCanvasCoordinatesFromTouch(touch);
         if (this.lastTouchTime > 0 && performance.now() - this.lastTouchTime <= 300) { // double touch
            this.lastTouchTime = 0;
            this.pointerController.createKnot(cPoint); }
          else {                                           // single touch
            this.lastTouchTime = performance.now();
            this.pointerController.startDragging(cPoint); }
         event.preventDefault(); }
       else if (touches.length == 2) {                     // zoom gesture
         this.startZooming(touches);
         event.preventDefault(); }};

   private touchMoveEventListener = (event: TouchEvent) => {
      const touches = event.touches;
      if (touches.length == 1) {
         const touch = touches[0];
         const cPoint = this.getCanvasCoordinatesFromTouch(touch);
         if (this.pointerController.processPointerMove(cPoint)) {
            event.preventDefault(); }}
       else if (touches.length == 2 && this.zooming) {
         this.zoom(touches);
         event.preventDefault(); }};

   private touchEndEventListener = (event: TouchEvent) => {
      if (this.pointerController.stopDragging() || this.zooming) {
         this.zooming = false;
         event.preventDefault(); }};

   private getCanvasCoordinatesFromTouch (touch: Touch) : Point {
      const wctx = this.wctx;
      return wctx.mapViewportToCanvasCoordinates({x: touch.clientX, y: touch.clientY}); }

   private startZooming (touches: TouchList) {
      const wctx = this.wctx;
      const touch1 = touches[0];
      const touch2 = touches[1];
      const cPoint1 = this.getCanvasCoordinatesFromTouch(touch1);
      const cPoint2 = this.getCanvasCoordinatesFromTouch(touch2);
      const cCenter = PointUtils.computeCenter(cPoint1, cPoint2);
      const xDist = Math.abs(cPoint1.x - cPoint2.x);
      const yDist = Math.abs(cPoint1.y - cPoint2.y);
      this.zoomLCenter = wctx.mapCanvasToLogicalCoordinates(cCenter);
      this.zoomStartDist = PointUtils.computeDistance(cPoint1, cPoint2);
      this.zoomStartFactorX = wctx.eState.zoomFactorX;
      this.zoomStartFactorY = wctx.eState.zoomFactorY;
      this.zoomX = xDist * 2 > yDist;
      this.zoomY = yDist * 2 > xDist;
      this.zooming = true; }

   private zoom (touches: TouchList) {
      const wctx = this.wctx;
      const touch1 = touches[0];
      const touch2 = touches[1];
      const cPoint1 = this.getCanvasCoordinatesFromTouch(touch1);
      const cPoint2 = this.getCanvasCoordinatesFromTouch(touch2);
      const newCCenter = PointUtils.computeCenter(cPoint1, cPoint2);
      const newDist = PointUtils.computeDistance(cPoint1, cPoint2);
      const f = newDist / this.zoomStartDist;
      if (this.zoomX) {
         wctx.eState.zoomFactorX = this.zoomStartFactorX * f; }
      if (this.zoomY) {
         wctx.eState.zoomFactorY = this.zoomStartFactorY * f; }
      wctx.adjustPlaneOrigin(newCCenter, this.zoomLCenter);
      wctx.refresh(); }}

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
      if (this.processKeyDown(event.which)) {
         event.stopPropagation(); }};

   private keyPressEventListener = (event: KeyboardEvent) => {
      if (this.processKeyPress(event.which)) {
         event.stopPropagation(); }};

   private processKeyDown (keyCode: number) {
      const wctx = this.wctx;
      switch (keyCode) {
         case 8: case 46: {                                // backspace and delete keys
            if (wctx.iState.selectedKnotNdx != null) {
               wctx.iState.knotDragging = false;
               wctx.deleteKnot(wctx.iState.selectedKnotNdx);
               wctx.refresh();
               wctx.fireChangeEvent(); }
            return true; }}
      return false; }

   private processKeyPress (keyCharCode: number) {
      const wctx = this.wctx;
      const c = String.fromCharCode(keyCharCode);
      switch (c) {
         case "+": case "-": case "x": case "X": case "y": case "Y": {
            const fx = (c == '+' || c == 'X') ? Math.SQRT2 : (c == '-' || c == 'x') ? Math.SQRT1_2 : 1;
            const fy = (c == '+' || c == 'Y') ? Math.SQRT2 : (c == '-' || c == 'y') ? Math.SQRT1_2 : 1;
            wctx.zoom(fx, fy);
            wctx.refresh();
            return true; }
         case "r": {
            wctx.reset();
            wctx.refresh();
            wctx.fireChangeEvent();
            return true; }
         case "c": {
            wctx.clearKnots();
            wctx.refresh();
            wctx.fireChangeEvent();
            return true; }
         case "e": {
            wctx.eState.extendedDomain = !wctx.eState.extendedDomain;
            wctx.refresh();
            return true; }
         case "g": {
            wctx.eState.gridEnabled = !wctx.eState.gridEnabled;
            wctx.refresh();
            return true; }
         case "s": {
            wctx.eState.snapToGridEnabled = !wctx.eState.snapToGridEnabled;
            return true; }
         case "l": {
            wctx.eState.linearInterpolation = !wctx.eState.linearInterpolation;
            wctx.refresh();
            wctx.fireChangeEvent();
            return true; }
         case "k": {
            const s1 = PointUtils.encodeCoordinateList(wctx.eState.knots);
            const s2 = window.prompt("Knot coordinates:", s1);
            if (s2 == null || s2 == "" || s1 == s2) {
               return; }
            let newKnots: Point[];
            try {
               newKnots = PointUtils.decodeCoordinateList(s2); }
             catch (e) {
               window.alert("Input could not be decoded. " + e);
               return; }
            wctx.replaceKnots(newKnots);
            wctx.refresh();
            wctx.fireChangeEvent();
            return true; }
         default: {
            return false; }}}}

//--- Internal widget context --------------------------------------------------

const changeEvent = new CustomEvent("change");

interface InteractionState {
   selectedKnotNdx:          number | null;                // index of currently selected knot or null
   potentialKnotNdx:         number | null;                // index of potential target knot for mouse click (or null)
   knotDragging:             boolean;                      // true if the selected knot is beeing dragged
   planeDragging:            boolean; }                    // true if the coordinate plane is beeing dragged

class WidgetContext {

   public plotter:           FunctionPlotter;
   public mouseController:   MouseController;
   public touchController:   TouchController;
   public kbController:      KeyboardController;

   public canvas:            HTMLCanvasElement;            // the DOM canvas element
   public eventListeners:    EventListener[];
   public isConnected:       boolean;

   public eState:            EditorState;                  // current editor state
   public initialEState:     EditorState;                  // last set initial editor state
   public iState:            InteractionState;

   constructor (canvas: HTMLCanvasElement) {
      this.canvas = canvas;
      this.eventListeners = [];
      this.isConnected = false;
      this.setEditorState(<EditorState>{});
      this.resetInteractionState();
      this.plotter = new FunctionPlotter(this); }

   public connect() {
      if (this.isConnected) {
         return; }
      this.mouseController = new MouseController(this);
      this.touchController = new TouchController(this);
      this.kbController    = new KeyboardController(this);
      this.isConnected = true; }

   public disconnect() {
      if (!this.isConnected) {
         return; }
      this.mouseController.dispose();
      this.touchController.dispose();
      this.kbController.dispose();
      this.isConnected = false; }

   public adjustBackingBitmapResolution() {
      this.canvas.width = this.canvas.clientWidth || 200;
      this.canvas.height = this.canvas.clientHeight || 200; }

   public setEditorState (eState: EditorState) {
      this.eState = cloneEditorState(eState);
      this.initialEState = cloneEditorState(eState); }

   public getEditorState() : EditorState {
      return cloneEditorState(this.eState); }

   private resetInteractionState() {
      this.iState = {
         selectedKnotNdx:  null,
         potentialKnotNdx: null,
         knotDragging:     false,
         planeDragging:    false}; }

   // Resets the context to the initial state.
   public reset() {
      this.setEditorState(this.initialEState);
      this.resetInteractionState(); }

   public clearKnots() {
      this.eState.knots = Array();
      this.resetInteractionState(); }

   public mapLogicalToCanvasXCoordinate (lx: number) : number {
      return (lx - this.eState.planeOrigin.x) * this.eState.zoomFactorX; }

   public mapLogicalToCanvasYCoordinate (ly: number) : number {
      return this.canvas.height - (ly - this.eState.planeOrigin.y) * this.eState.zoomFactorY; }

   public mapLogicalToCanvasCoordinates (lPoint: Point) : Point {
      return {x: this.mapLogicalToCanvasXCoordinate(lPoint.x), y: this.mapLogicalToCanvasYCoordinate(lPoint.y)}; }

   public mapCanvasToLogicalXCoordinate (cx: number) : number {
      return this.eState.planeOrigin.x + cx / this.eState.zoomFactorX; }

   public mapCanvasToLogicalYCoordinate (cy: number) : number {
      return this.eState.planeOrigin.y + (this.canvas.height - cy) / this.eState.zoomFactorY; }

   public mapCanvasToLogicalCoordinates (cPoint: Point) : Point {
      return {x: this.mapCanvasToLogicalXCoordinate(cPoint.x), y: this.mapCanvasToLogicalYCoordinate(cPoint.y)}; }

   public mapViewportToCanvasCoordinates (vPoint: Point) : Point {
      const rect = this.canvas.getBoundingClientRect();
      const x1 = vPoint.x - rect.left - (this.canvas.clientLeft || 0);
      const y1 = vPoint.y - rect.top  - (this.canvas.clientTop  || 0);
         // Our canvas element may have a border, but must have no padding.
         // In the future, the CSSOM View Module can probably be used for proper coordinate mapping.
      const x = x1 / rect.width  * this.canvas.width;
      const y = y1 / rect.height * this.canvas.height;
      return {x, y}; }

   public adjustPlaneOrigin (cPoint: Point, lPoint: Point) {
      const x = lPoint.x - cPoint.x / this.eState.zoomFactorX;
      const y = lPoint.y - (this.canvas.height - cPoint.y) / this.eState.zoomFactorY;
      this.eState.planeOrigin = {x, y}; }

   public getZoomFactor (xy: boolean) : number {
      return xy ? this.eState.zoomFactorX : this.eState.zoomFactorY; }

   public zoom (fx: number, fy?: number, cCenter?: Point) {
      if (fy == null) {
         fy = fx; }
      if (cCenter == null) {
         cCenter = {x: this.canvas.width / 2, y: this.canvas.height / 2}; }
      const lCenter = this.mapCanvasToLogicalCoordinates(cCenter);
      this.eState.zoomFactorX *= fx;
      this.eState.zoomFactorY *= fy;
      this.adjustPlaneOrigin(cCenter, lCenter); }

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
      if (knotNdx == null) {
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
      this.iState.knotDragging = this.iState.knotDragging && this.iState.selectedKnotNdx != null; }

   // Returns the index and distance of the nearest knot or null.
   public findNearestKnot (cPoint: Point) : {knotNdx: number, distance: number} | null {
      const knots = this.eState.knots;
      let minDist: number | null = null;
      let nearestKnotNdx: number | null = null;
      for (let i = 0; i < knots.length; i++) {
         const lKnot = knots[i];
         const cKnot = this.mapLogicalToCanvasCoordinates(lKnot);
         const d = PointUtils.computeDistance(cKnot, cPoint);
         if (minDist == null || d < minDist) {
            nearestKnotNdx = i;
            minDist = d; }}
      return (nearestKnotNdx != null) ? {knotNdx: nearestKnotNdx, distance: minDist!} : null; }

   public getGridParms (xy: boolean) : {space: number, span: number, pos: number, decPow: number} | null {
      const minSpaceC = xy ? 66 : 50;                                              // minimum space between grid lines in pixel
      const edge = xy ? this.eState.planeOrigin.x : this.eState.planeOrigin.y;     // canvas edge coordinate
      const minSpaceL = minSpaceC / this.getZoomFactor(xy);                        // minimum space between grid lines in logical coordinate units
      const decPow = Math.ceil(Math.log(minSpaceL / 5) / Math.LN10);               // decimal power of grid line space
      const edgeDecPow = (edge == 0) ? -99 : Math.log(Math.abs(edge)) / Math.LN10; // decimal power of canvas coordinates
      if (edgeDecPow - decPow > 10) {
         return null; }                                                            // numerically instable
      const space = Math.pow(10, decPow);                                          // grid line space (distance) in logical units
      const f = minSpaceL / space;                                                 // minimum for span factor
      const span = (f > 2.001) ? 5 : (f > 1.001) ? 2 : 1;                          // span factor for visible grid lines
      const p1 = Math.ceil(edge / space);
      const pos = span * Math.ceil(p1 / span);                                     // position of first grid line in grid space units
      return {space: space, span: span, pos: pos, decPow: decPow}; }

   public createInterpolationFunction() : UniFunction {
      const knots = this.eState.knots;
      const n = knots.length;
      const xVals: number[] = Array(n);
      const yVals: number[] = Array(n);
      for (let i = 0; i < n; i++) {
         xVals[i] = knots[i].x;
         yVals[i] = knots[i].y; }
      if (n >= 5 && !this.eState.linearInterpolation) {
         return createAkimaSplineInterpolator(xVals, yVals); }
       else if (n >= 3 && !this.eState.linearInterpolation) {
         return createCubicSplineInterpolator(xVals, yVals); }
       else if (n >= 2) {
         return createLinearInterpolator(xVals, yVals); }
       else {
         const c = (n == 1) ? knots[0].y : 1;
         return (_x: number) => c; }}

   // Re-paints the canvas and updates the cursor.
   public refresh() {
      this.plotter.paint();
      this.updateCanvasCursorStyle(); }

   private updateCanvasCursorStyle() {
      const style = (this.iState.knotDragging || this.iState.planeDragging) ? "move" : "auto";
      this.canvas.style.cursor = style; }

   public fireChangeEvent() {
      for (let listener of this.eventListeners) {
         listener.call(this, changeEvent); }}}

//--- Editor state -------------------------------------------------------------

// Function curve editor state.
export interface EditorState {
   knots:                    Point[];                      // knot points for the interpolation
   planeOrigin:              Point;                        // coordinate plane origin (logical coordinates of lower left canvas corner)
   zoomFactorX:              number;                       // zoom factor for x coordinate values
   zoomFactorY:              number;                       // zoom factor for y coordinate values
   extendedDomain:           boolean;                      // false = function domain is from first to last knot, true = function domain is extended
   relevantXMin:             number | null;                // lower edge of relevant X range or null
   relevantXMax:             number | null;                // upper edge of relevant X range or null
   gridEnabled:              boolean;                      // true to draw a coordinate grid
   snapToGridEnabled:        boolean;                      // true to enable snap to grid behavior
   linearInterpolation:      boolean; }                    // true to only use linear interpolation, no Akima interpolation

// Clones and adds missing fields.
function cloneEditorState (eState: EditorState) : EditorState {
   let eState2 = <EditorState>{};
   eState2.knots               = get(eState.knots, []).slice();
   eState2.planeOrigin         = PointUtils.clone(get(eState.planeOrigin, {x: 0, y: 0}));
   eState2.zoomFactorX         = get(eState.zoomFactorX, 1);
   eState2.zoomFactorY         = get(eState.zoomFactorY, 1);
   eState2.extendedDomain      = get(eState.extendedDomain, true);
   eState2.relevantXMin        = get(eState.relevantXMin, null);
   eState2.relevantXMax        = get(eState.relevantXMax, null);
   eState2.gridEnabled         = get(eState.gridEnabled, true);
   eState2.snapToGridEnabled   = get(eState.snapToGridEnabled, true);
   eState2.linearInterpolation = get(eState.linearInterpolation, false);
   return eState2;
   function get<T> (value: T, defaultValue: T) : T {
      return (value === undefined) ? defaultValue : value; }}

//--- Widget -------------------------------------------------------------------

export class Widget {

   private wctx:             WidgetContext;

   constructor (canvas: HTMLCanvasElement) {
      this.wctx = new WidgetContext(canvas); }

   // Called after the widget has been inserted into the DOM.
   // Installs the internal event listeners for mouse, touch and keyboard.
   // Adjusts the resolution of the backing bitmap.
   public connectedCallback() {
      const wctx = this.wctx;
      wctx.connect();
      wctx.adjustBackingBitmapResolution();
      wctx.refresh(); }

   // Called when the widget is removed from the DOM.
   // Uninstalls the internal event listeners for mouse, touch and keyboard.
   public disconnectedCallback() {
      this.wctx.disconnect(); }

   // Registers an event listener.
   // Currently only the "change" event is supported.
   // The "change" event is fired after the user has changed the edited function
   // so that the function values are different. It is not fired when only the display
   // of the function has changed, e.g. by zooming or moving the plane.
   public addEventListener (type: string, listener: EventListener) {
      if (type != "change") {
         throw new Error("Unsupported event type."); }
      const listeners = this.wctx.eventListeners;
      if (listeners.indexOf(listener) >= 0) {
         return; }
      listeners.push(listener); }

   // Deregisters an event listener.
   public removeEventListener (type: string, listener: EventListener) {
      if (type != "change") {
         throw new Error("Unsupported event type."); }
      const listeners = this.wctx.eventListeners;
      const p = listeners.indexOf(listener);
      if (p < 0) {
         return; }
      listeners.splice(p, 1); }

   // Returns the current state of the function curve editor.
   public getEditorState() : EditorState {
      return this.wctx.getEditorState(); }

   // Updates the current state of the function curve editor.
   public setEditorState (eState: EditorState) {
      const wctx = this.wctx;
      wctx.setEditorState(eState);
      if (wctx.isConnected) {
         wctx.refresh(); }}

   // Returns the current graph function.
   // The returned JavaScript function maps each x value to an y value.
   public getFunction() : (x: number) => number {
      return this.wctx.createInterpolationFunction(); }

   // Returns the help text as an array.
   public static getRawHelpText() : string[] {
      return [
         "drag knot with mouse or touch",  "move a knot",
         "drag plane with mouse or touch", "move the coordinate space",
         "click or tap on knot",           "select a knot",
         "Delete / Backspace",             "delete the selected knot",
         "double-click or double-tap",     "create a new knot",
         "mouse wheel",                    "zoom both axis",
         "shift + mouse wheel",            "zoom x-axis",
         "alt or ctrl + mouse wheel",      "zoom y-axis",
         "touch zoom gesture",             "zoom x, y or both axis",
         "+ / -",                          "zoom both axis in/out",
         "X / x",                          "zoom x-axis in/out",
         "Y / y",                          "zoom y-axis in/out",
         "e",                              "toggle extended function domain",
         "g",                              "toggle coordinate grid",
         "s",                              "toggle snap to grid",
         "l",                              "toggle between linear interpolation and Akima",
         "k",                              "knots (display prompt with coordinate values)",
         "c",                              "clear the canvas",
         "r",                              "reset to the initial state" ]; }

   // Returns the help text as a HTML string.
   public static getFormattedHelpText() : string {
      const t = Widget.getRawHelpText();
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
