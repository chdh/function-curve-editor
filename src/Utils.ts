const dummyResolvedPromise = Promise.resolve();

export function nextTick (callback: () => void) {
   void dummyResolvedPromise.then(callback); }

export function removeValueFromArray<T> (a: Array<T>, value: T) {
   const i = a.indexOf(value);
   if (i >= 0) {
      a.splice(i, 1); }}
