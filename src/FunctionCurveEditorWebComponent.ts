import {Widget, EditorState} from "./FunctionCurveEditor";

export class FunctionCurveEditorElement extends HTMLElement {

   private widget:           Widget;

   constructor() {
      super();
      this.attachShadow({mode: "open"});
      this.shadowRoot!.innerHTML = htmlTemplate;
      const canvas = <HTMLCanvasElement>this.shadowRoot!.querySelector("canvas");
      this.widget = new Widget(canvas);
      this.widget.addEventListener("change", (event: Event) => this.dispatchEvent(event)); }

   // Called by the browser when the element is inserted into the DOM.
   connectedCallback() {
      this.widget.connectedCallback(); }

   // Called by the browser when the element is removed from the DOM.
   disconnectedCallback() {
      this.widget.disconnectedCallback(); }

   // Returns the current state of the function curve editor.
   public getEditorState() : EditorState {
      return this.widget.getEditorState(); }

   // Updates the current state of the function curve editor.
   public setEditorState (eState: EditorState) {
      this.widget.setEditorState(eState); }

   // Returns the current graph function.
   // The returned JavaScript function maps each x value to an y value.
   public getFunction() : (x: number) => number {
      return this.widget.getFunction(); }

   // Returns the help text as an array.
   public getRawHelpText() : string[] {
      return this.widget.getRawHelpText(); }

   // Returns the help text as a HTML string.
   public getFormattedHelpText() : string {
      return this.widget.getFormattedHelpText(); }}

const style = `
   :host {
      display: block;
      contain: content;
      background-color: #f8f8f8;
      border-style: solid;
      border-width: 1px;
      border-color: #dddddd;
   }
   canvas {
      display: block;
      width: 100%;
      height: 100%;
      outline: none;
   }
   `;

const htmlTemplate = `
   <style>${style}</style>
   <canvas tabindex="1">
   </canvas>
   `;

export function registerCustomElement() {
   customElements.define("function-curve-editor", FunctionCurveEditorElement); }
