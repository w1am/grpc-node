"use strict";
/*
 * Copyright 2020 gRPC authors.
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
const assert = require("assert");
const src_1 = require("../src");
describe('loadPackageDefinition', () => {
    it('Should not allow prototype pollution', () => {
        (0, src_1.loadPackageDefinition)({ '__proto__.polluted': true });
        assert.notStrictEqual({}.polluted, true);
    });
    it('Should not allow prototype pollution #2', () => {
        (0, src_1.loadPackageDefinition)({ 'constructor.prototype.polluted': true });
        assert.notStrictEqual({}.polluted, true);
    });
});
//# sourceMappingURL=test-prototype-pollution.js.map