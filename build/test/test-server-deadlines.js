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
const path = require("path");
const grpc = require("../src");
const src_1 = require("../src");
const common_1 = require("./common");
const clientInsecureCreds = grpc.credentials.createInsecure();
const serverInsecureCreds = src_1.ServerCredentials.createInsecure();
describe('Server deadlines', () => {
    let server;
    let client;
    before(done => {
        const protoFile = path.join(__dirname, 'fixtures', 'test_service.proto');
        const testServiceDef = (0, common_1.loadProtoFile)(protoFile);
        const testServiceClient = testServiceDef.TestService;
        server = new src_1.Server();
        server.addService(testServiceClient.service, {
            unary(call, cb) {
                setTimeout(() => {
                    cb(null, {});
                }, 2000);
            },
        });
        server.bindAsync('localhost:0', serverInsecureCreds, (err, port) => {
            assert.ifError(err);
            client = new testServiceClient(`localhost:${port}`, clientInsecureCreds);
            server.start();
            done();
        });
    });
    after(done => {
        client.close();
        server.tryShutdown(done);
    });
    it('works with deadlines', done => {
        const metadata = new grpc.Metadata();
        const { path, requestSerialize: serialize, responseDeserialize: deserialize, } = client.unary;
        metadata.set('grpc-timeout', '100m');
        client.makeUnaryRequest(path, serialize, deserialize, {}, metadata, {}, (error, response) => {
            assert(error);
            assert.strictEqual(error.code, grpc.status.DEADLINE_EXCEEDED);
            assert.strictEqual(error.details, 'Deadline exceeded');
            done();
        });
    });
    it('rejects invalid deadline', done => {
        const metadata = new grpc.Metadata();
        const { path, requestSerialize: serialize, responseDeserialize: deserialize, } = client.unary;
        metadata.set('grpc-timeout', 'Infinity');
        client.makeUnaryRequest(path, serialize, deserialize, {}, metadata, {}, (error, response) => {
            assert(error);
            assert.strictEqual(error.code, grpc.status.OUT_OF_RANGE);
            assert.strictEqual(error.details, 'Invalid deadline');
            done();
        });
    });
});
describe('Cancellation', () => {
    let server;
    let client;
    let inHandler = false;
    let cancelledInServer = false;
    before(done => {
        const protoFile = path.join(__dirname, 'fixtures', 'test_service.proto');
        const testServiceDef = (0, common_1.loadProtoFile)(protoFile);
        const testServiceClient = testServiceDef.TestService;
        server = new src_1.Server();
        server.addService(testServiceClient.service, {
            serverStream(stream) {
                inHandler = true;
                stream.on('cancelled', () => {
                    stream.write({});
                    stream.end();
                    cancelledInServer = true;
                });
            },
        });
        server.bindAsync('localhost:0', serverInsecureCreds, (err, port) => {
            assert.ifError(err);
            client = new testServiceClient(`localhost:${port}`, clientInsecureCreds);
            server.start();
            done();
        });
    });
    after(done => {
        client.close();
        server.tryShutdown(done);
    });
    it('handles requests cancelled by the client', done => {
        const call = client.serverStream({});
        call.on('data', assert.ifError);
        call.on('error', (error) => {
            assert.strictEqual(error.code, grpc.status.CANCELLED);
            assert.strictEqual(error.details, 'Cancelled on client');
            waitForServerCancel();
        });
        function waitForHandler() {
            if (inHandler === true) {
                call.cancel();
                return;
            }
            setImmediate(waitForHandler);
        }
        function waitForServerCancel() {
            if (cancelledInServer === true) {
                done();
                return;
            }
            setImmediate(waitForServerCancel);
        }
        waitForHandler();
    });
});
//# sourceMappingURL=test-server-deadlines.js.map