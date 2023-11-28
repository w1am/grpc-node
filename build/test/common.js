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
exports.assert2 = exports.MockSubchannel = exports.TestClient = exports.TestServer = exports.loadProtoFile = exports.mockFunction = void 0;
const loader = require("@grpc/proto-loader");
const assert2 = require("./assert2");
exports.assert2 = assert2;
const path = require("path");
const grpc = require("../src");
const make_client_1 = require("../src/make-client");
const fs_1 = require("fs");
const connectivity_state_1 = require("../src/connectivity-state");
const protoLoaderOptions = {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
};
function mockFunction() {
    throw new Error('Not implemented');
}
exports.mockFunction = mockFunction;
function loadProtoFile(file) {
    const packageDefinition = loader.loadSync(file, protoLoaderOptions);
    return (0, make_client_1.loadPackageDefinition)(packageDefinition);
}
exports.loadProtoFile = loadProtoFile;
const protoFile = path.join(__dirname, 'fixtures', 'echo_service.proto');
const echoService = loadProtoFile(protoFile)
    .EchoService;
const ca = (0, fs_1.readFileSync)(path.join(__dirname, 'fixtures', 'ca.pem'));
const key = (0, fs_1.readFileSync)(path.join(__dirname, 'fixtures', 'server1.key'));
const cert = (0, fs_1.readFileSync)(path.join(__dirname, 'fixtures', 'server1.pem'));
const serviceImpl = {
    echo: (call, callback) => {
        callback(null, call.request);
    },
};
class TestServer {
    constructor(useTls, options) {
        this.useTls = useTls;
        this.port = null;
        this.server = new grpc.Server(options);
        this.server.addService(echoService.service, serviceImpl);
    }
    start() {
        let credentials;
        if (this.useTls) {
            credentials = grpc.ServerCredentials.createSsl(null, [
                { private_key: key, cert_chain: cert },
            ]);
        }
        else {
            credentials = grpc.ServerCredentials.createInsecure();
        }
        return new Promise((resolve, reject) => {
            this.server.bindAsync('localhost:0', credentials, (error, port) => {
                if (error) {
                    reject(error);
                    return;
                }
                this.port = port;
                this.server.start();
                resolve();
            });
        });
    }
    shutdown() {
        this.server.forceShutdown();
    }
}
exports.TestServer = TestServer;
class TestClient {
    constructor(port, useTls, options) {
        let credentials;
        if (useTls) {
            credentials = grpc.credentials.createSsl(ca);
        }
        else {
            credentials = grpc.credentials.createInsecure();
        }
        this.client = new echoService(`localhost:${port}`, credentials, options);
    }
    static createFromServer(server, options) {
        if (server.port === null) {
            throw new Error('Cannot create client, server not started');
        }
        return new TestClient(server.port, server.useTls, options);
    }
    waitForReady(deadline, callback) {
        this.client.waitForReady(deadline, callback);
    }
    sendRequest(callback) {
        this.client.echo({}, callback);
    }
    getChannelState() {
        return this.client.getChannel().getConnectivityState(false);
    }
    close() {
        this.client.close();
    }
}
exports.TestClient = TestClient;
/**
 * A mock subchannel that transitions between states on command, to test LB
 * policy behavior
 */
class MockSubchannel {
    constructor(address, initialState = grpc.connectivityState.IDLE) {
        this.address = address;
        this.listeners = new Set();
        this.state = initialState;
    }
    getConnectivityState() {
        return this.state;
    }
    addConnectivityStateListener(listener) {
        this.listeners.add(listener);
    }
    removeConnectivityStateListener(listener) {
        this.listeners.delete(listener);
    }
    transitionToState(nextState) {
        grpc.experimental.trace(grpc.logVerbosity.DEBUG, 'subchannel', this.address +
            ' ' +
            connectivity_state_1.ConnectivityState[this.state] +
            ' -> ' +
            connectivity_state_1.ConnectivityState[nextState]);
        for (const listener of this.listeners) {
            listener(this, this.state, nextState, 0);
        }
        this.state = nextState;
    }
    startConnecting() { }
    getAddress() {
        return this.address;
    }
    throttleKeepalive(newKeepaliveTime) { }
    ref() { }
    unref() { }
    getChannelzRef() {
        return {
            kind: 'subchannel',
            id: -1,
            name: this.address,
        };
    }
    getRealSubchannel() {
        throw new Error('Method not implemented.');
    }
    realSubchannelEquals(other) {
        return this === other;
    }
}
exports.MockSubchannel = MockSubchannel;
//# sourceMappingURL=common.js.map