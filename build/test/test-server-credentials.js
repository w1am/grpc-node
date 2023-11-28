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
// Allow `any` data type for testing runtime type checking.
// tslint:disable no-any
const assert = require("assert");
const fs_1 = require("fs");
const path_1 = require("path");
const src_1 = require("../src");
const ca = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'fixtures', 'ca.pem'));
const key = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'fixtures', 'server1.key'));
const cert = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'fixtures', 'server1.pem'));
describe('Server Credentials', () => {
    describe('createInsecure', () => {
        it('creates insecure credentials', () => {
            const creds = src_1.ServerCredentials.createInsecure();
            assert.strictEqual(creds._isSecure(), false);
            assert.strictEqual(creds._getSettings(), null);
        });
    });
    describe('createSsl', () => {
        it('accepts a buffer and array as the first two arguments', () => {
            var _a;
            const creds = src_1.ServerCredentials.createSsl(ca, []);
            assert.strictEqual(creds._isSecure(), true);
            assert.strictEqual((_a = creds._getSettings()) === null || _a === void 0 ? void 0 : _a.ca, ca);
        });
        it('accepts a boolean as the third argument', () => {
            const creds = src_1.ServerCredentials.createSsl(ca, [], true);
            assert.strictEqual(creds._isSecure(), true);
            const settings = creds._getSettings();
            assert.strictEqual(settings === null || settings === void 0 ? void 0 : settings.ca, ca);
            assert.strictEqual(settings === null || settings === void 0 ? void 0 : settings.requestCert, true);
        });
        it('accepts an object with two buffers in the second argument', () => {
            const keyCertPairs = [{ private_key: key, cert_chain: cert }];
            const creds = src_1.ServerCredentials.createSsl(null, keyCertPairs);
            assert.strictEqual(creds._isSecure(), true);
            const settings = creds._getSettings();
            assert.deepStrictEqual(settings === null || settings === void 0 ? void 0 : settings.cert, [cert]);
            assert.deepStrictEqual(settings === null || settings === void 0 ? void 0 : settings.key, [key]);
        });
        it('accepts multiple objects in the second argument', () => {
            const keyCertPairs = [
                { private_key: key, cert_chain: cert },
                { private_key: key, cert_chain: cert },
            ];
            const creds = src_1.ServerCredentials.createSsl(null, keyCertPairs, false);
            assert.strictEqual(creds._isSecure(), true);
            const settings = creds._getSettings();
            assert.deepStrictEqual(settings === null || settings === void 0 ? void 0 : settings.cert, [cert, cert]);
            assert.deepStrictEqual(settings === null || settings === void 0 ? void 0 : settings.key, [key, key]);
        });
        it('fails if the second argument is not an Array', () => {
            assert.throws(() => {
                src_1.ServerCredentials.createSsl(ca, 'test');
            }, /TypeError: keyCertPairs must be an array/);
        });
        it('fails if the first argument is a non-Buffer value', () => {
            assert.throws(() => {
                src_1.ServerCredentials.createSsl('test', []);
            }, /TypeError: rootCerts must be null or a Buffer/);
        });
        it('fails if the third argument is a non-boolean value', () => {
            assert.throws(() => {
                src_1.ServerCredentials.createSsl(ca, [], 'test');
            }, /TypeError: checkClientCertificate must be a boolean/);
        });
        it('fails if the array elements are not objects', () => {
            assert.throws(() => {
                src_1.ServerCredentials.createSsl(ca, ['test']);
            }, /TypeError: keyCertPair\[0\] must be an object/);
            assert.throws(() => {
                src_1.ServerCredentials.createSsl(ca, [null]);
            }, /TypeError: keyCertPair\[0\] must be an object/);
        });
        it('fails if the object does not have a Buffer private key', () => {
            const keyCertPairs = [{ private_key: 'test', cert_chain: cert }];
            assert.throws(() => {
                src_1.ServerCredentials.createSsl(null, keyCertPairs);
            }, /TypeError: keyCertPair\[0\].private_key must be a Buffer/);
        });
        it('fails if the object does not have a Buffer cert chain', () => {
            const keyCertPairs = [{ private_key: key, cert_chain: 'test' }];
            assert.throws(() => {
                src_1.ServerCredentials.createSsl(null, keyCertPairs);
            }, /TypeError: keyCertPair\[0\].cert_chain must be a Buffer/);
        });
    });
});
//# sourceMappingURL=test-server-credentials.js.map