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
const assert = require("assert");
const grpc = require("../src");
const src_1 = require("../src");
const src_2 = require("../src");
const connectivity_state_1 = require("../src/connectivity-state");
const clientInsecureCreds = grpc.credentials.createInsecure();
const serverInsecureCreds = src_1.ServerCredentials.createInsecure();
describe('Client', () => {
    let server;
    let client;
    before(done => {
        server = new src_1.Server();
        server.bindAsync('localhost:0', serverInsecureCreds, (err, port) => {
            assert.ifError(err);
            client = new src_2.Client(`localhost:${port}`, clientInsecureCreds);
            server.start();
            done();
        });
    });
    after(done => {
        client.close();
        server.tryShutdown(done);
    });
    it('should call the waitForReady callback only once, when channel connectivity state is READY', done => {
        const deadline = Date.now() + 100;
        let calledTimes = 0;
        client.waitForReady(deadline, err => {
            assert.ifError(err);
            assert.equal(client.getChannel().getConnectivityState(true), connectivity_state_1.ConnectivityState.READY);
            calledTimes += 1;
        });
        setTimeout(() => {
            assert.equal(calledTimes, 1);
            done();
        }, deadline - Date.now());
    });
});
describe('Client without a server', () => {
    let client;
    before(() => {
        // Arbitrary target that should not have a running server
        client = new src_2.Client('localhost:12345', clientInsecureCreds);
    });
    after(() => {
        client.close();
    });
    it('should fail multiple calls to the nonexistent server', function (done) {
        this.timeout(5000);
        // Regression test for https://github.com/grpc/grpc-node/issues/1411
        client.makeUnaryRequest('/service/method', x => x, x => x, Buffer.from([]), (error, value) => {
            assert(error);
            assert.strictEqual(error === null || error === void 0 ? void 0 : error.code, grpc.status.UNAVAILABLE);
            client.makeUnaryRequest('/service/method', x => x, x => x, Buffer.from([]), (error, value) => {
                assert(error);
                assert.strictEqual(error === null || error === void 0 ? void 0 : error.code, grpc.status.UNAVAILABLE);
                done();
            });
        });
    });
});
describe('Client with a nonexistent target domain', () => {
    let client;
    before(() => {
        // DNS name that does not exist per RFC 6761 section 6.4
        client = new src_2.Client('host.invalid', clientInsecureCreds);
    });
    after(() => {
        client.close();
    });
    it('should fail multiple calls', function (done) {
        this.timeout(5000);
        // Regression test for https://github.com/grpc/grpc-node/issues/1411
        client.makeUnaryRequest('/service/method', x => x, x => x, Buffer.from([]), (error, value) => {
            assert(error);
            assert.strictEqual(error === null || error === void 0 ? void 0 : error.code, grpc.status.UNAVAILABLE);
            client.makeUnaryRequest('/service/method', x => x, x => x, Buffer.from([]), (error, value) => {
                assert(error);
                assert.strictEqual(error === null || error === void 0 ? void 0 : error.code, grpc.status.UNAVAILABLE);
                done();
            });
        });
    });
});
//# sourceMappingURL=test-client.js.map