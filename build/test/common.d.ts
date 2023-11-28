import * as assert2 from './assert2';
import * as grpc from '../src';
import { GrpcObject } from '../src/make-client';
import { SubchannelInterface } from '../src/subchannel-interface';
import { SubchannelRef } from '../src/channelz';
import { Subchannel } from '../src/subchannel';
export declare function mockFunction(): never;
export declare function loadProtoFile(file: string): GrpcObject;
export declare class TestServer {
    useTls: boolean;
    private server;
    port: number | null;
    constructor(useTls: boolean, options?: grpc.ChannelOptions);
    start(): Promise<void>;
    shutdown(): void;
}
export declare class TestClient {
    private client;
    constructor(port: number, useTls: boolean, options?: grpc.ChannelOptions);
    static createFromServer(server: TestServer, options?: grpc.ChannelOptions): TestClient;
    waitForReady(deadline: grpc.Deadline, callback: (error?: Error) => void): void;
    sendRequest(callback: (error?: grpc.ServiceError) => void): void;
    getChannelState(): grpc.connectivityState;
    close(): void;
}
/**
 * A mock subchannel that transitions between states on command, to test LB
 * policy behavior
 */
export declare class MockSubchannel implements SubchannelInterface {
    private readonly address;
    private state;
    private listeners;
    constructor(address: string, initialState?: grpc.connectivityState);
    getConnectivityState(): grpc.connectivityState;
    addConnectivityStateListener(listener: grpc.experimental.ConnectivityStateListener): void;
    removeConnectivityStateListener(listener: grpc.experimental.ConnectivityStateListener): void;
    transitionToState(nextState: grpc.connectivityState): void;
    startConnecting(): void;
    getAddress(): string;
    throttleKeepalive(newKeepaliveTime: number): void;
    ref(): void;
    unref(): void;
    getChannelzRef(): SubchannelRef;
    getRealSubchannel(): Subchannel;
    realSubchannelEquals(other: grpc.experimental.SubchannelInterface): boolean;
}
export { assert2 };
