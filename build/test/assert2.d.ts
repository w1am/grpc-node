/**
 * Assert that the given function doesn't throw an error, and then return
 * its value.
 * @param fn The function to evaluate.
 */
export declare function noThrowAndReturn<T>(fn: () => T): T;
export declare function clearMustCalls(): void;
/**
 * Wraps a function to keep track of whether it was called or not.
 * @param fn The function to wrap.
 */
export declare function mustCall<T>(fn: (...args: any[]) => T): (...args: any[]) => T;
/**
 * Calls the given function when every function that was wrapped with
 * mustCall has been called.
 * @param fn The function to call once all mustCall-wrapped functions have
 *           been called.
 */
export declare function afterMustCallsSatisfied(fn: () => void): void;
