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
const fs = require("fs");
const http2 = require("http2");
const path = require("path");
const protoLoader = require("@grpc/proto-loader");
const grpc = require("../src");
const src_1 = require("../src");
const common_1 = require("./common");
const compression_algorithms_1 = require("../src/compression-algorithms");
const loadedTestServiceProto = protoLoader.loadSync(path.join(__dirname, 'fixtures/test_service.proto'), {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const testServiceGrpcObject = grpc.loadPackageDefinition(loadedTestServiceProto);
const ca = fs.readFileSync(path.join(__dirname, 'fixtures', 'ca.pem'));
const key = fs.readFileSync(path.join(__dirname, 'fixtures', 'server1.key'));
const cert = fs.readFileSync(path.join(__dirname, 'fixtures', 'server1.pem'));
function noop() { }
describe('Server', () => {
    describe('constructor', () => {
        it('should work with no arguments', () => {
            assert.doesNotThrow(() => {
                new src_1.Server(); // tslint:disable-line:no-unused-expression
            });
        });
        it('should work with an empty object argument', () => {
            assert.doesNotThrow(() => {
                new src_1.Server({}); // tslint:disable-line:no-unused-expression
            });
        });
        it('should be an instance of Server', () => {
            const server = new src_1.Server();
            assert(server instanceof src_1.Server);
        });
    });
    describe('bindAsync', () => {
        it('binds with insecure credentials', done => {
            const server = new src_1.Server();
            server.bindAsync('localhost:0', src_1.ServerCredentials.createInsecure(), (err, port) => {
                assert.ifError(err);
                assert(typeof port === 'number' && port > 0);
                server.tryShutdown(done);
            });
        });
        it('binds with secure credentials', done => {
            const server = new src_1.Server();
            const creds = src_1.ServerCredentials.createSsl(ca, [{ private_key: key, cert_chain: cert }], true);
            server.bindAsync('localhost:0', creds, (err, port) => {
                assert.ifError(err);
                assert(typeof port === 'number' && port > 0);
                server.tryShutdown(done);
            });
        });
        it('throws if bind is called after the server is started', done => {
            const server = new src_1.Server();
            server.bindAsync('localhost:0', src_1.ServerCredentials.createInsecure(), (err, port) => {
                assert.ifError(err);
                server.start();
                assert.throws(() => {
                    server.bindAsync('localhost:0', src_1.ServerCredentials.createInsecure(), noop);
                }, /server is already started/);
                server.tryShutdown(done);
            });
        });
        it('throws on invalid inputs', () => {
            const server = new src_1.Server();
            assert.throws(() => {
                server.bindAsync(null, src_1.ServerCredentials.createInsecure(), noop);
            }, /port must be a string/);
            assert.throws(() => {
                server.bindAsync('localhost:0', null, noop);
            }, /creds must be a ServerCredentials object/);
            assert.throws(() => {
                server.bindAsync('localhost:0', grpc.credentials.createInsecure(), noop);
            }, /creds must be a ServerCredentials object/);
            assert.throws(() => {
                server.bindAsync('localhost:0', src_1.ServerCredentials.createInsecure(), null);
            }, /callback must be a function/);
        });
    });
    describe('start', () => {
        let server;
        beforeEach(done => {
            server = new src_1.Server();
            server.bindAsync('localhost:0', src_1.ServerCredentials.createInsecure(), done);
        });
        afterEach(done => {
            server.tryShutdown(done);
        });
        it('starts without error', () => {
            assert.doesNotThrow(() => {
                server.start();
            });
        });
        it('throws if started twice', () => {
            server.start();
            assert.throws(() => {
                server.start();
            }, /server is already started/);
        });
        it('throws if the server is not bound', () => {
            const server = new src_1.Server();
            assert.throws(() => {
                server.start();
            }, /server must be bound in order to start/);
        });
    });
    describe('addService', () => {
        const mathProtoFile = path.join(__dirname, 'fixtures', 'math.proto');
        const mathClient = (0, common_1.loadProtoFile)(mathProtoFile).math.Math;
        const mathServiceAttrs = mathClient.service;
        const dummyImpls = { div() { }, divMany() { }, fib() { }, sum() { } };
        const altDummyImpls = { Div() { }, DivMany() { }, Fib() { }, Sum() { } };
        it('succeeds with a single service', () => {
            const server = new src_1.Server();
            assert.doesNotThrow(() => {
                server.addService(mathServiceAttrs, dummyImpls);
            });
        });
        it('fails to add an empty service', () => {
            const server = new src_1.Server();
            assert.throws(() => {
                server.addService({}, dummyImpls);
            }, /Cannot add an empty service to a server/);
        });
        it('fails with conflicting method names', () => {
            const server = new src_1.Server();
            server.addService(mathServiceAttrs, dummyImpls);
            assert.throws(() => {
                server.addService(mathServiceAttrs, dummyImpls);
            }, /Method handler for .+ already provided/);
        });
        it('supports method names as originally written', () => {
            const server = new src_1.Server();
            assert.doesNotThrow(() => {
                server.addService(mathServiceAttrs, altDummyImpls);
            });
        });
        it('succeeds after server has been started', done => {
            const server = new src_1.Server();
            server.bindAsync('localhost:0', src_1.ServerCredentials.createInsecure(), (err, port) => {
                assert.ifError(err);
                server.start();
                assert.doesNotThrow(() => {
                    server.addService(mathServiceAttrs, dummyImpls);
                });
                server.tryShutdown(done);
            });
        });
    });
    describe('removeService', () => {
        let server;
        let client;
        const mathProtoFile = path.join(__dirname, 'fixtures', 'math.proto');
        const mathClient = (0, common_1.loadProtoFile)(mathProtoFile).math.Math;
        const mathServiceAttrs = mathClient.service;
        const dummyImpls = { div() { }, divMany() { }, fib() { }, sum() { } };
        beforeEach(done => {
            server = new src_1.Server();
            server.addService(mathServiceAttrs, dummyImpls);
            server.bindAsync('localhost:0', src_1.ServerCredentials.createInsecure(), (err, port) => {
                assert.ifError(err);
                client = new mathClient(`localhost:${port}`, grpc.credentials.createInsecure());
                server.start();
                done();
            });
        });
        afterEach(done => {
            client.close();
            server.tryShutdown(done);
        });
        it('succeeds with a single service by removing all method handlers', done => {
            server.removeService(mathServiceAttrs);
            let methodsVerifiedCount = 0;
            const methodsToVerify = Object.keys(mathServiceAttrs);
            const assertFailsWithUnimplementedError = (error) => {
                assert(error);
                assert.strictEqual(error.code, grpc.status.UNIMPLEMENTED);
                methodsVerifiedCount++;
                if (methodsVerifiedCount === methodsToVerify.length) {
                    done();
                }
            };
            methodsToVerify.forEach(method => {
                const call = client[method]({}, assertFailsWithUnimplementedError); // for unary
                call.on('error', assertFailsWithUnimplementedError); // for streamed
            });
        });
        it('fails for non-object service definition argument', () => {
            assert.throws(() => {
                server.removeService('upsie');
            }, /removeService.*requires object as argument/);
        });
    });
    describe('unregister', () => {
        let server;
        let client;
        const mathProtoFile = path.join(__dirname, 'fixtures', 'math.proto');
        const mathClient = (0, common_1.loadProtoFile)(mathProtoFile).math.Math;
        const mathServiceAttrs = mathClient.service;
        beforeEach(done => {
            server = new src_1.Server();
            server.addService(mathServiceAttrs, {
                div(call, callback) {
                    callback(null, { quotient: '42' });
                },
            });
            server.bindAsync('localhost:0', src_1.ServerCredentials.createInsecure(), (err, port) => {
                assert.ifError(err);
                client = new mathClient(`localhost:${port}`, grpc.credentials.createInsecure());
                server.start();
                done();
            });
        });
        afterEach(done => {
            client.close();
            server.tryShutdown(done);
        });
        it('removes handler by name and returns true', done => {
            const name = mathServiceAttrs['Div'].path;
            assert.strictEqual(server.unregister(name), true, 'Server#unregister should return true on success');
            client.div({ divisor: 4, dividend: 3 }, (error, response) => {
                assert(error);
                assert.strictEqual(error.code, grpc.status.UNIMPLEMENTED);
                done();
            });
        });
        it('returns false for unknown handler', () => {
            assert.strictEqual(server.unregister('noOneHere'), false, 'Server#unregister should return false on failure');
        });
    });
    it('throws when unimplemented methods are called', () => {
        const server = new src_1.Server();
        assert.throws(() => {
            server.addProtoService();
        }, /Not implemented. Use addService\(\) instead/);
        assert.throws(() => {
            server.addHttp2Port();
        }, /Not yet implemented/);
        assert.throws(() => {
            server.bind('localhost:0', src_1.ServerCredentials.createInsecure());
        }, /Not implemented. Use bindAsync\(\) instead/);
    });
    describe('Default handlers', () => {
        let server;
        let client;
        const mathProtoFile = path.join(__dirname, 'fixtures', 'math.proto');
        const mathClient = (0, common_1.loadProtoFile)(mathProtoFile).math.Math;
        const mathServiceAttrs = mathClient.service;
        before(done => {
            server = new src_1.Server();
            server.addService(mathServiceAttrs, {});
            server.bindAsync('localhost:0', src_1.ServerCredentials.createInsecure(), (err, port) => {
                assert.ifError(err);
                client = new mathClient(`localhost:${port}`, grpc.credentials.createInsecure());
                server.start();
                done();
            });
        });
        after(done => {
            client.close();
            server.tryShutdown(done);
        });
        it('should respond to a unary call with UNIMPLEMENTED', done => {
            client.div({ divisor: 4, dividend: 3 }, (error, response) => {
                assert(error);
                assert.strictEqual(error.code, grpc.status.UNIMPLEMENTED);
                assert.match(error.details, /does not implement the method.*Div/);
                done();
            });
        });
        it('should respond to a client stream with UNIMPLEMENTED', done => {
            const call = client.sum((error, response) => {
                assert(error);
                assert.strictEqual(error.code, grpc.status.UNIMPLEMENTED);
                assert.match(error.details, /does not implement the method.*Sum/);
                done();
            });
            call.end();
        });
        it('should respond to a server stream with UNIMPLEMENTED', done => {
            const call = client.fib({ limit: 5 });
            call.on('data', (value) => {
                assert.fail('No messages expected');
            });
            call.on('error', (err) => {
                assert(err);
                assert.strictEqual(err.code, grpc.status.UNIMPLEMENTED);
                assert.match(err.details, /does not implement the method.*Fib/);
                done();
            });
        });
        it('should respond to a bidi call with UNIMPLEMENTED', done => {
            const call = client.divMany();
            call.on('data', (value) => {
                assert.fail('No messages expected');
            });
            call.on('error', (err) => {
                assert(err);
                assert.strictEqual(err.code, grpc.status.UNIMPLEMENTED);
                assert.match(err.details, /does not implement the method.*DivMany/);
                done();
            });
            call.end();
        });
    });
    describe('Unregistered service', () => {
        let server;
        let client;
        const mathProtoFile = path.join(__dirname, 'fixtures', 'math.proto');
        const mathClient = (0, common_1.loadProtoFile)(mathProtoFile).math.Math;
        before(done => {
            server = new src_1.Server();
            // Don't register a service at all
            server.bindAsync('localhost:0', src_1.ServerCredentials.createInsecure(), (err, port) => {
                assert.ifError(err);
                client = new mathClient(`localhost:${port}`, grpc.credentials.createInsecure());
                server.start();
                done();
            });
        });
        after(done => {
            client.close();
            server.tryShutdown(done);
        });
        it('should respond to a unary call with UNIMPLEMENTED', done => {
            client.div({ divisor: 4, dividend: 3 }, (error, response) => {
                assert(error);
                assert.strictEqual(error.code, grpc.status.UNIMPLEMENTED);
                assert.match(error.details, /does not implement the method.*Div/);
                done();
            });
        });
        it('should respond to a client stream with UNIMPLEMENTED', done => {
            const call = client.sum((error, response) => {
                assert(error);
                assert.strictEqual(error.code, grpc.status.UNIMPLEMENTED);
                assert.match(error.details, /does not implement the method.*Sum/);
                done();
            });
            call.end();
        });
        it('should respond to a server stream with UNIMPLEMENTED', done => {
            const call = client.fib({ limit: 5 });
            call.on('data', (value) => {
                assert.fail('No messages expected');
            });
            call.on('error', (err) => {
                assert(err);
                assert.strictEqual(err.code, grpc.status.UNIMPLEMENTED);
                assert.match(err.details, /does not implement the method.*Fib/);
                done();
            });
        });
        it('should respond to a bidi call with UNIMPLEMENTED', done => {
            const call = client.divMany();
            call.on('data', (value) => {
                assert.fail('No messages expected');
            });
            call.on('error', (err) => {
                assert(err);
                assert.strictEqual(err.code, grpc.status.UNIMPLEMENTED);
                assert.match(err.details, /does not implement the method.*DivMany/);
                done();
            });
            call.end();
        });
    });
});
describe('Echo service', () => {
    let server;
    let client;
    const protoFile = path.join(__dirname, 'fixtures', 'echo_service.proto');
    const echoService = (0, common_1.loadProtoFile)(protoFile)
        .EchoService;
    const serviceImplementation = {
        echo(call, callback) {
            callback(null, call.request);
        },
        echoBidiStream(call) {
            call.on('data', data => {
                call.write(data);
            });
            call.on('end', () => {
                call.end();
            });
        },
    };
    before(done => {
        server = new src_1.Server();
        server.addService(echoService.service, serviceImplementation);
        server.bindAsync('localhost:0', src_1.ServerCredentials.createInsecure(), (err, port) => {
            assert.ifError(err);
            client = new echoService(`localhost:${port}`, grpc.credentials.createInsecure());
            server.start();
            done();
        });
    });
    after(done => {
        client.close();
        server.tryShutdown(done);
    });
    it('should echo the recieved message directly', done => {
        client.echo({ value: 'test value', value2: 3 }, (error, response) => {
            assert.ifError(error);
            assert.deepStrictEqual(response, { value: 'test value', value2: 3 });
            done();
        });
    });
    /* This test passes on Node 18 but fails on Node 16. The failure appears to
     * be caused by https://github.com/nodejs/node/issues/42713 */
    it.skip('should continue a stream after server shutdown', done => {
        const server2 = new src_1.Server();
        server2.addService(echoService.service, serviceImplementation);
        server2.bindAsync('localhost:0', src_1.ServerCredentials.createInsecure(), (err, port) => {
            if (err) {
                done(err);
                return;
            }
            const client2 = new echoService(`localhost:${port}`, grpc.credentials.createInsecure());
            server2.start();
            const stream = client2.echoBidiStream();
            const totalMessages = 5;
            let messagesSent = 0;
            stream.write({ value: 'test value', value2: messagesSent });
            messagesSent += 1;
            stream.on('data', () => {
                if (messagesSent === 1) {
                    server2.tryShutdown(common_1.assert2.mustCall(() => { }));
                }
                if (messagesSent >= totalMessages) {
                    stream.end();
                }
                else {
                    stream.write({ value: 'test value', value2: messagesSent });
                    messagesSent += 1;
                }
            });
            stream.on('status', common_1.assert2.mustCall((status) => {
                assert.strictEqual(status.code, grpc.status.OK);
                assert.strictEqual(messagesSent, totalMessages);
            }));
            stream.on('error', () => { });
            common_1.assert2.afterMustCallsSatisfied(done);
        });
    });
});
describe('Generic client and server', () => {
    function toString(val) {
        return val.toString();
    }
    function toBuffer(str) {
        return Buffer.from(str);
    }
    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    const stringServiceAttrs = {
        capitalize: {
            path: '/string/capitalize',
            requestStream: false,
            responseStream: false,
            requestSerialize: toBuffer,
            requestDeserialize: toString,
            responseSerialize: toBuffer,
            responseDeserialize: toString,
        },
    };
    describe('String client and server', () => {
        let client;
        let server;
        before(done => {
            server = new src_1.Server();
            server.addService(stringServiceAttrs, {
                capitalize(call, callback) {
                    callback(null, capitalize(call.request));
                },
            });
            server.bindAsync('localhost:0', src_1.ServerCredentials.createInsecure(), (err, port) => {
                assert.ifError(err);
                server.start();
                const clientConstr = grpc.makeGenericClientConstructor(stringServiceAttrs, 'unused_but_lets_appease_typescript_anyway');
                client = new clientConstr(`localhost:${port}`, grpc.credentials.createInsecure());
                done();
            });
        });
        after(done => {
            client.close();
            server.tryShutdown(done);
        });
        it('Should respond with a capitalized string', done => {
            client.capitalize('abc', (err, response) => {
                assert.ifError(err);
                assert.strictEqual(response, 'Abc');
                done();
            });
        });
    });
    it('responds with HTTP status of 415 on invalid content-type', done => {
        const server = new src_1.Server();
        const creds = src_1.ServerCredentials.createInsecure();
        server.bindAsync('localhost:0', creds, (err, port) => {
            assert.ifError(err);
            const client = http2.connect(`http://localhost:${port}`);
            let count = 0;
            function makeRequest(headers) {
                const req = client.request(headers);
                let statusCode;
                req.on('response', headers => {
                    statusCode = headers[http2.constants.HTTP2_HEADER_STATUS];
                    assert.strictEqual(statusCode, http2.constants.HTTP_STATUS_UNSUPPORTED_MEDIA_TYPE);
                });
                req.on('end', () => {
                    assert(statusCode);
                    count++;
                    if (count === 2) {
                        client.close();
                        server.tryShutdown(done);
                    }
                });
                req.end();
            }
            server.start();
            // Missing Content-Type header.
            makeRequest({ ':path': '/' });
            // Invalid Content-Type header.
            makeRequest({ ':path': '/', 'content-type': 'application/not-grpc' });
        });
    });
});
describe('Compressed requests', () => {
    const testServiceHandlers = {
        Unary(call, callback) {
            callback(null, { count: 500000, message: call.request.message });
        },
        ClientStream(call, callback) {
            let timesCalled = 0;
            call.on('data', () => {
                timesCalled += 1;
            });
            call.on('end', () => {
                callback(null, { count: timesCalled });
            });
        },
        ServerStream(call) {
            const { request } = call;
            for (let i = 0; i < 5; i++) {
                call.write({ count: request.message.length });
            }
            call.end();
        },
        BidiStream(call) {
            call.on('data', (data) => {
                call.write({ count: data.message.length });
            });
            call.on('end', () => {
                call.end();
            });
        },
    };
    describe('Test service client and server with deflate', () => {
        let client;
        let server;
        let assignedPort;
        before(done => {
            server = new src_1.Server();
            server.addService(testServiceGrpcObject.TestService.service, testServiceHandlers);
            server.bindAsync('localhost:0', src_1.ServerCredentials.createInsecure(), (err, port) => {
                assert.ifError(err);
                server.start();
                assignedPort = port;
                client = new testServiceGrpcObject.TestService(`localhost:${assignedPort}`, grpc.credentials.createInsecure(), {
                    'grpc.default_compression_algorithm': compression_algorithms_1.CompressionAlgorithms.deflate,
                });
                done();
            });
        });
        after(done => {
            client.close();
            server.tryShutdown(done);
        });
        it('Should compress and decompress when performing unary call', done => {
            client.unary({ message: 'foo' }, (err, response) => {
                assert.ifError(err);
                done();
            });
        });
        it('Should compress and decompress when performing client stream', done => {
            const clientStream = client.clientStream((err, res) => {
                assert.ifError(err);
                assert.equal(res === null || res === void 0 ? void 0 : res.count, 3);
                done();
            });
            clientStream.write({ message: 'foo' }, () => {
                clientStream.write({ message: 'bar' }, () => {
                    clientStream.write({ message: 'baz' }, () => {
                        setTimeout(() => clientStream.end(), 10);
                    });
                });
            });
        });
        it('Should compress and decompress when performing server stream', done => {
            const serverStream = client.serverStream({ message: 'foobar' });
            let timesResponded = 0;
            serverStream.on('data', () => {
                timesResponded += 1;
            });
            serverStream.on('error', err => {
                assert.ifError(err);
                done();
            });
            serverStream.on('end', () => {
                assert.equal(timesResponded, 5);
                done();
            });
        });
        it('Should compress and decompress when performing bidi stream', done => {
            const bidiStream = client.bidiStream();
            let timesRequested = 0;
            let timesResponded = 0;
            bidiStream.on('data', () => {
                timesResponded += 1;
            });
            bidiStream.on('error', err => {
                assert.ifError(err);
                done();
            });
            bidiStream.on('end', () => {
                assert.equal(timesResponded, timesRequested);
                done();
            });
            bidiStream.write({ message: 'foo' }, () => {
                timesRequested += 1;
                bidiStream.write({ message: 'bar' }, () => {
                    timesRequested += 1;
                    bidiStream.write({ message: 'baz' }, () => {
                        timesRequested += 1;
                        setTimeout(() => bidiStream.end(), 10);
                    });
                });
            });
        });
        it('Should compress and decompress with gzip', done => {
            client = new testServiceGrpcObject.TestService(`localhost:${assignedPort}`, grpc.credentials.createInsecure(), {
                'grpc.default_compression_algorithm': compression_algorithms_1.CompressionAlgorithms.gzip,
            });
            client.unary({ message: 'foo' }, (err, response) => {
                assert.ifError(err);
                done();
            });
        });
        it('Should compress and decompress when performing client stream', done => {
            const clientStream = client.clientStream((err, res) => {
                assert.ifError(err);
                assert.equal(res === null || res === void 0 ? void 0 : res.count, 3);
                done();
            });
            clientStream.write({ message: 'foo' }, () => {
                clientStream.write({ message: 'bar' }, () => {
                    clientStream.write({ message: 'baz' }, () => {
                        setTimeout(() => clientStream.end(), 10);
                    });
                });
            });
        });
        it('Should compress and decompress when performing server stream', done => {
            const serverStream = client.serverStream({ message: 'foobar' });
            let timesResponded = 0;
            serverStream.on('data', () => {
                timesResponded += 1;
            });
            serverStream.on('error', err => {
                assert.ifError(err);
                done();
            });
            serverStream.on('end', () => {
                assert.equal(timesResponded, 5);
                done();
            });
        });
        it('Should compress and decompress when performing bidi stream', done => {
            const bidiStream = client.bidiStream();
            let timesRequested = 0;
            let timesResponded = 0;
            bidiStream.on('data', () => {
                timesResponded += 1;
            });
            bidiStream.on('error', err => {
                assert.ifError(err);
                done();
            });
            bidiStream.on('end', () => {
                assert.equal(timesResponded, timesRequested);
                done();
            });
            bidiStream.write({ message: 'foo' }, () => {
                timesRequested += 1;
                bidiStream.write({ message: 'bar' }, () => {
                    timesRequested += 1;
                    bidiStream.write({ message: 'baz' }, () => {
                        timesRequested += 1;
                        setTimeout(() => bidiStream.end(), 10);
                    });
                });
            });
        });
        it('Should handle large messages', done => {
            let longMessage = '';
            for (let i = 0; i < 400000; i++) {
                const letter = 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
                longMessage = longMessage + letter.repeat(10);
            }
            client.unary({ message: longMessage }, (err, response) => {
                assert.ifError(err);
                assert.strictEqual(response === null || response === void 0 ? void 0 : response.message, longMessage);
                done();
            });
        });
        /* As of Node 16, Writable and Duplex streams validate the encoding
         * argument to write, and the flags values we are passing there are not
         * valid. We don't currently have an alternative way to pass that flag
         * down, so for now this feature is not supported. */
        it.skip('Should not compress requests when the NoCompress write flag is used', done => {
            const bidiStream = client.bidiStream();
            let timesRequested = 0;
            let timesResponded = 0;
            bidiStream.on('data', () => {
                timesResponded += 1;
            });
            bidiStream.on('error', err => {
                assert.ifError(err);
                done();
            });
            bidiStream.on('end', () => {
                assert.equal(timesResponded, timesRequested);
                done();
            });
            bidiStream.write({ message: 'foo' }, '2', (err) => {
                assert.ifError(err);
                timesRequested += 1;
                setTimeout(() => bidiStream.end(), 10);
            });
        });
    });
});
//# sourceMappingURL=test-server.js.map