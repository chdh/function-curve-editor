// A simplified polyfill for the EventTarget interface of the DOM, because not all browsers support the EventTarget constructor yet.

export default class EventTargetPolyfill {

   private listenerMap:      Map<string, EventListener[]>;

   constructor() {
      this.listenerMap = new Map(); }

   public addEventListener (type: string, listener: EventListener) {
      let a = this.listenerMap.get(type);
      if (!a) {
         a = [];
         this.listenerMap.set(type, a); }
       else if (a.includes(listener)) {
         return; }
      a.push(listener); }

   public removeEventListener (type: string, listener: EventListener) {
      const a = this.listenerMap.get(type);
      if (!a) {
         return; }
      const i = a.indexOf(listener);
      if (i < 0) {
         return; }
      a.splice(i, 1); }

   // Note: event.target, event.currentTarget and "this" are not set when the listeners are called.
   // Event.stopPropagation() etc. is not handled.
   public dispatchEvent (event: Event) : boolean {
      const a = this.listenerMap.get(event.type);
      if (!a) {
         return true; }
      const a2 = a.slice();
      for (const listener of a2) {
         listener(event); }
      return true; }}
