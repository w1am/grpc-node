"use strict";
/*
 * Copyright 2022 gRPC authors.
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
const path = require("path");
const grpc = require("../src");
const src_1 = require("../src");
const common_1 = require("./common");
const protoFile = path.join(__dirname, 'fixtures', 'echo_service.proto');
const echoService = (0, common_1.loadProtoFile)(protoFile)
    .EchoService;
describe('Local subchannel pool', () => {
    let server;
    let serverPort;
    before(done => {
        server = new src_1.Server();
        server.addService(echoService.service, {
            echo(call, callback) {
                callback(null, call.request);
            },
        });
        server.bindAsync('localhost:0', src_1.ServerCredentials.createInsecure(), (err, port) => {
            assert.ifError(err);
            serverPort = port;
            server.start();
            done();
        });
    });
    after(done => {
        server.tryShutdown(done);
    });
    it('should complete the client lifecycle without error', done => {
        const client = new echoService(`localhost:${serverPort}`, grpc.credentials.createInsecure(), { 'grpc.use_local_subchannel_pool': 1 });
        client.echo({ value: 'test value', value2: 3 }, (error, response) => {
            assert.ifError(error);
            assert.deepStrictEqual(response, { value: 'test value', value2: 3 });
            client.close();
            done();
        });
    });
});
//# sourceMappingURL=test-local-subchannel-pool.js.map