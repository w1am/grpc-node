"use strict";
/*
 * Copyright 2023 gRPC authors.
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
const common_1 = require("./common");
describe('Channel idle timer', () => {
    let server;
    let client = null;
    before(() => {
        server = new common_1.TestServer(false);
        return server.start();
    });
    afterEach(() => {
        if (client) {
            client.close();
            client = null;
        }
    });
    after(() => {
        server.shutdown();
    });
    it('Should go idle after the specified time after a request ends', function (done) {
        this.timeout(5000);
        client = common_1.TestClient.createFromServer(server, {
            'grpc.client_idle_timeout_ms': 1000,
        });
        client.sendRequest(error => {
            assert.ifError(error);
            assert.strictEqual(client.getChannelState(), grpc.connectivityState.READY);
            setTimeout(() => {
                assert.strictEqual(client.getChannelState(), grpc.connectivityState.IDLE);
                done();
            }, 1100);
        });
    });
    it('Should be able to make a request after going idle', function (done) {
        this.timeout(5000);
        client = common_1.TestClient.createFromServer(server, {
            'grpc.client_idle_timeout_ms': 1000,
        });
        client.sendRequest(error => {
            assert.ifError(error);
            assert.strictEqual(client.getChannelState(), grpc.connectivityState.READY);
            setTimeout(() => {
                assert.strictEqual(client.getChannelState(), grpc.connectivityState.IDLE);
                client.sendRequest(error => {
                    assert.ifError(error);
                    done();
                });
            }, 1100);
        });
    });
    it('Should go idle after the specified time after waitForReady ends', function (done) {
        this.timeout(5000);
        client = common_1.TestClient.createFromServer(server, {
            'grpc.client_idle_timeout_ms': 1000,
        });
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 3);
        client.waitForReady(deadline, error => {
            assert.ifError(error);
            assert.strictEqual(client.getChannelState(), grpc.connectivityState.READY);
            setTimeout(() => {
                assert.strictEqual(client.getChannelState(), grpc.connectivityState.IDLE);
                done();
            }, 1100);
        });
    });
    it('Should ensure that the timeout is at least 1 second', function (done) {
        client = common_1.TestClient.createFromServer(server, {
            'grpc.client_idle_timeout_ms': 50,
        });
        client.sendRequest(error => {
            assert.ifError(error);
            assert.strictEqual(client.getChannelState(), grpc.connectivityState.READY);
            setTimeout(() => {
                // Should still be ready after 100ms
                assert.strictEqual(client.getChannelState(), grpc.connectivityState.READY);
                setTimeout(() => {
                    // Should go IDLE after another second
                    assert.strictEqual(client.getChannelState(), grpc.connectivityState.IDLE);
                    done();
                }, 1000);
            }, 100);
        });
    });
});
//# sourceMappingURL=test-idle-timer.js.map