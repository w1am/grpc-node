"use strict";
/*
 * Copyright 2021 gRPC authors.
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
const TIMEOUT_SERVICE_CONFIG = {
    loadBalancingConfig: [],
    methodConfig: [
        {
            name: [{ service: 'TestService' }],
            timeout: {
                seconds: 1,
                nanos: 0,
            },
        },
    ],
};
describe('Client with configured timeout', () => {
    let server;
    let Client;
    let client;
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
        server.bindAsync('localhost:0', grpc.ServerCredentials.createInsecure(), (error, port) => {
            if (error) {
                done(error);
                return;
            }
            server.start();
            client = new Client(`localhost:${port}`, grpc.credentials.createInsecure(), { 'grpc.service_config': JSON.stringify(TIMEOUT_SERVICE_CONFIG) });
            done();
        });
    });
    after(done => {
        client.close();
        server.tryShutdown(done);
    });
    it('Should end calls without explicit deadline with DEADLINE_EXCEEDED', done => {
        client.unary({}, (error, value) => {
            assert(error);
            assert.strictEqual(error.code, grpc.status.DEADLINE_EXCEEDED);
            done();
        });
    });
    it('Should end calls with a long explicit deadline with DEADLINE_EXCEEDED', done => {
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 20);
        client.unary({}, (error, value) => {
            assert(error);
            assert.strictEqual(error.code, grpc.status.DEADLINE_EXCEEDED);
            done();
        });
    });
});
//# sourceMappingURL=test-deadline.js.map