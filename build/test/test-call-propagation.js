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
const grpc = require("../src");
const common_1 = require("./common");
function multiDone(done, target) {
    let count = 0;
    return () => {
        count++;
        if (count >= target) {
            done();
        }
    };
}
describe('Call propagation', () => {
    let server;
    let Client;
    let client;
    let proxyServer;
    let proxyClient;
    before(done => {
        Client = (0, common_1.loadProtoFile)(__dirname + '/fixtures/test_service.proto')
            .TestService;
        server = new grpc.Server();
        server.addService(Client.service, {
            unary: () => { },
            clientStream: () => { },
            serverStream: () => { },
            bidiStream: () => { },
        });
        proxyServer = new grpc.Server();
        server.bindAsync('localhost:0', grpc.ServerCredentials.createInsecure(), (error, port) => {
            if (error) {
                done(error);
                return;
            }
            server.start();
            client = new Client(`localhost:${port}`, grpc.credentials.createInsecure());
            proxyServer.bindAsync('localhost:0', grpc.ServerCredentials.createInsecure(), (error, proxyPort) => {
                if (error) {
                    done(error);
                    return;
                }
                proxyServer.start();
                proxyClient = new Client(`localhost:${proxyPort}`, grpc.credentials.createInsecure());
                done();
            });
        });
    });
    afterEach(() => {
        proxyServer.removeService(Client.service);
    });
    after(() => {
        server.forceShutdown();
        proxyServer.forceShutdown();
    });
    describe('Cancellation', () => {
        it('should work with unary requests', done => {
            done = multiDone(done, 2);
            // eslint-disable-next-line prefer-const
            let call;
            proxyServer.addService(Client.service, {
                unary: (parent, callback) => {
                    client.unary(parent.request, { parent: parent }, (error, value) => {
                        callback(error, value);
                        assert(error);
                        assert.strictEqual(error.code, grpc.status.CANCELLED);
                        done();
                    });
                    /* Cancel the original call after the server starts processing it to
                     * ensure that it does reach the server. */
                    call.cancel();
                },
            });
            call = proxyClient.unary({}, (error, value) => {
                assert(error);
                assert.strictEqual(error.code, grpc.status.CANCELLED);
                done();
            });
        });
        it('Should work with client streaming requests', done => {
            done = multiDone(done, 2);
            // eslint-disable-next-line prefer-const
            let call;
            proxyServer.addService(Client.service, {
                clientStream: (parent, callback) => {
                    client.clientStream({ parent: parent }, (error, value) => {
                        callback(error, value);
                        assert(error);
                        assert.strictEqual(error.code, grpc.status.CANCELLED);
                        done();
                    });
                    /* Cancel the original call after the server starts processing it to
                     * ensure that it does reach the server. */
                    call.cancel();
                },
            });
            call = proxyClient.clientStream((error, value) => {
                assert(error);
                assert.strictEqual(error.code, grpc.status.CANCELLED);
                done();
            });
        });
        it('Should work with server streaming requests', done => {
            done = multiDone(done, 2);
            // eslint-disable-next-line prefer-const
            let call;
            proxyServer.addService(Client.service, {
                serverStream: (parent) => {
                    const child = client.serverStream(parent.request, { parent: parent });
                    child.on('error', () => { });
                    child.on('status', (status) => {
                        assert.strictEqual(status.code, grpc.status.CANCELLED);
                        done();
                    });
                    call.cancel();
                },
            });
            call = proxyClient.serverStream({});
            call.on('error', () => { });
            call.on('status', (status) => {
                assert.strictEqual(status.code, grpc.status.CANCELLED);
                done();
            });
        });
        it('Should work with bidi streaming requests', done => {
            done = multiDone(done, 2);
            // eslint-disable-next-line prefer-const
            let call;
            proxyServer.addService(Client.service, {
                bidiStream: (parent) => {
                    const child = client.bidiStream({ parent: parent });
                    child.on('error', () => { });
                    child.on('status', (status) => {
                        assert.strictEqual(status.code, grpc.status.CANCELLED);
                        done();
                    });
                    call.cancel();
                },
            });
            call = proxyClient.bidiStream();
            call.on('error', () => { });
            call.on('status', (status) => {
                assert.strictEqual(status.code, grpc.status.CANCELLED);
                done();
            });
        });
    });
    describe('Deadlines', () => {
        it('should work with unary requests', done => {
            done = multiDone(done, 2);
            proxyServer.addService(Client.service, {
                unary: (parent, callback) => {
                    client.unary(parent.request, { parent: parent, propagate_flags: grpc.propagate.DEADLINE }, (error, value) => {
                        callback(error, value);
                        assert(error);
                        assert.strictEqual(error.code, grpc.status.DEADLINE_EXCEEDED);
                        done();
                    });
                },
            });
            const deadline = new Date();
            deadline.setMilliseconds(deadline.getMilliseconds() + 100);
            proxyClient.unary({}, { deadline }, (error, value) => {
                assert(error);
                assert.strictEqual(error.code, grpc.status.DEADLINE_EXCEEDED);
                done();
            });
        });
        it('Should work with client streaming requests', done => {
            done = multiDone(done, 2);
            proxyServer.addService(Client.service, {
                clientStream: (parent, callback) => {
                    client.clientStream({ parent: parent, propagate_flags: grpc.propagate.DEADLINE }, (error, value) => {
                        callback(error, value);
                        assert(error);
                        assert.strictEqual(error.code, grpc.status.DEADLINE_EXCEEDED);
                        done();
                    });
                },
            });
            const deadline = new Date();
            deadline.setMilliseconds(deadline.getMilliseconds() + 100);
            proxyClient.clientStream({ deadline, propagate_flags: grpc.propagate.DEADLINE }, (error, value) => {
                assert(error);
                assert.strictEqual(error.code, grpc.status.DEADLINE_EXCEEDED);
                done();
            });
        });
        it('Should work with server streaming requests', done => {
            done = multiDone(done, 2);
            let call;
            proxyServer.addService(Client.service, {
                serverStream: (parent) => {
                    const child = client.serverStream(parent.request, {
                        parent: parent,
                        propagate_flags: grpc.propagate.DEADLINE,
                    });
                    child.on('error', () => { });
                    child.on('status', (status) => {
                        assert.strictEqual(status.code, grpc.status.DEADLINE_EXCEEDED);
                        done();
                    });
                },
            });
            const deadline = new Date();
            deadline.setMilliseconds(deadline.getMilliseconds() + 100);
            // eslint-disable-next-line prefer-const
            call = proxyClient.serverStream({}, { deadline });
            call.on('error', () => { });
            call.on('status', (status) => {
                assert.strictEqual(status.code, grpc.status.DEADLINE_EXCEEDED);
                done();
            });
        });
        it('Should work with bidi streaming requests', done => {
            done = multiDone(done, 2);
            let call;
            proxyServer.addService(Client.service, {
                bidiStream: (parent) => {
                    const child = client.bidiStream({
                        parent: parent,
                        propagate_flags: grpc.propagate.DEADLINE,
                    });
                    child.on('error', () => { });
                    child.on('status', (status) => {
                        assert.strictEqual(status.code, grpc.status.DEADLINE_EXCEEDED);
                        done();
                    });
                },
            });
            const deadline = new Date();
            deadline.setMilliseconds(deadline.getMilliseconds() + 100);
            // eslint-disable-next-line prefer-const
            call = proxyClient.bidiStream({ deadline });
            call.on('error', () => { });
            call.on('status', (status) => {
                assert.strictEqual(status.code, grpc.status.DEADLINE_EXCEEDED);
                done();
            });
        });
    });
});
//# sourceMappingURL=test-call-propagation.js.map