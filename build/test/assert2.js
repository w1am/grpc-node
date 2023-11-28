"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.afterMustCallsSatisfied = exports.mustCall = exports.clearMustCalls = exports.noThrowAndReturn = void 0;
const assert = require("assert");
const toCall = new Map();
const afterCallsQueue = [];
/**
 * Assert that the given function doesn't throw an error, and then return
 * its value.
 * @param fn The function to evaluate.
 */
function noThrowAndReturn(fn) {
    try {
        return fn();
    }
    catch (e) {
        assert.throws(() => {
            throw e;
        });
        throw e; // for type safety only
    }
}
exports.noThrowAndReturn = noThrowAndReturn;
/**
 * Helper function that returns true when every function wrapped with
 * mustCall has been called.
 */
function mustCallsSatisfied() {
    let result = true;
    toCall.forEach(value => {
        result = result && value === 0;
    });
    return result;
}
function clearMustCalls() {
    afterCallsQueue.length = 0;
}
exports.clearMustCalls = clearMustCalls;
/**
 * Wraps a function to keep track of whether it was called or not.
 * @param fn The function to wrap.
 */
// tslint:disable:no-any
function mustCall(fn) {
    const existingValue = toCall.get(fn);
    if (existingValue !== undefined) {
        toCall.set(fn, existingValue + 1);
    }
    else {
        toCall.set(fn, 1);
    }
    return (...args) => {
        const result = fn(...args);
        const existingValue = toCall.get(fn);
        if (existingValue !== undefined) {
            toCall.set(fn, existingValue - 1);
        }
        if (mustCallsSatisfied()) {
            afterCallsQueue.forEach(fn => fn());
            afterCallsQueue.length = 0;
        }
        return result;
    };
}
exports.mustCall = mustCall;
/**
 * Calls the given function when every function that was wrapped with
 * mustCall has been called.
 * @param fn The function to call once all mustCall-wrapped functions have
 *           been called.
 */
function afterMustCallsSatisfied(fn) {
    if (!mustCallsSatisfied()) {
        afterCallsQueue.push(fn);
    }
    else {
        fn();
    }
}
exports.afterMustCallsSatisfied = afterMustCallsSatisfied;
//# sourceMappingURL=assert2.js.map