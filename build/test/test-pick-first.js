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
const connectivity_state_1 = require("../src/connectivity-state");
const load_balancer_1 = require("../src/load-balancer");
const load_balancer_pick_first_1 = require("../src/load-balancer-pick-first");
const metadata_1 = require("../src/metadata");
const subchannel_address_1 = require("../src/subchannel-address");
const common_1 = require("./common");
function updateStateCallBackForExpectedStateSequence(expectedStateSequence, done) {
    const actualStateSequence = [];
    let lastPicker = null;
    let finished = false;
    return (connectivityState, picker) => {
        var _a;
        if (finished) {
            return;
        }
        // Ignore duplicate state transitions
        if (connectivityState === actualStateSequence[actualStateSequence.length - 1]) {
            // Ignore READY duplicate state transitions if the picked subchannel is the same
            if (connectivityState !== connectivity_state_1.ConnectivityState.READY ||
                ((_a = lastPicker === null || lastPicker === void 0 ? void 0 : lastPicker.pick({ extraPickInfo: {}, metadata: new metadata_1.Metadata() })) === null || _a === void 0 ? void 0 : _a.subchannel) ===
                    picker.pick({ extraPickInfo: {}, metadata: new metadata_1.Metadata() })
                        .subchannel) {
                return;
            }
        }
        if (expectedStateSequence[actualStateSequence.length] !== connectivityState) {
            finished = true;
            done(new Error(`Unexpected state ${connectivity_state_1.ConnectivityState[connectivityState]} after [${actualStateSequence.map(value => connectivity_state_1.ConnectivityState[value])}]`));
            return;
        }
        actualStateSequence.push(connectivityState);
        lastPicker = picker;
        if (actualStateSequence.length === expectedStateSequence.length) {
            finished = true;
            done();
        }
    };
}
describe('Shuffler', () => {
    it('Should maintain the multiset of elements from the original array', () => {
        const originalArray = [1, 2, 2, 3, 3, 3, 4, 4, 5];
        for (let i = 0; i < 100; i++) {
            assert.deepStrictEqual((0, load_balancer_pick_first_1.shuffled)(originalArray).sort((a, b) => a - b), originalArray);
        }
    });
});
describe('pick_first load balancing policy', () => {
    const config = new load_balancer_pick_first_1.PickFirstLoadBalancingConfig(false);
    let subchannels = [];
    const baseChannelControlHelper = {
        createSubchannel: (subchannelAddress, subchannelArgs) => {
            const subchannel = new common_1.MockSubchannel((0, subchannel_address_1.subchannelAddressToString)(subchannelAddress));
            subchannels.push(subchannel);
            return subchannel;
        },
        addChannelzChild: () => { },
        removeChannelzChild: () => { },
        requestReresolution: () => { },
        updateState: () => { },
    };
    beforeEach(() => {
        subchannels = [];
    });
    it('Should report READY when a subchannel connects', done => {
        const channelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(baseChannelControlHelper, {
            updateState: updateStateCallBackForExpectedStateSequence([connectivity_state_1.ConnectivityState.CONNECTING, connectivity_state_1.ConnectivityState.READY], done),
        });
        const pickFirst = new load_balancer_pick_first_1.PickFirstLoadBalancer(channelControlHelper);
        pickFirst.updateAddressList([{ host: 'localhost', port: 1 }], config);
        process.nextTick(() => {
            subchannels[0].transitionToState(connectivity_state_1.ConnectivityState.READY);
        });
    });
    it('Should report READY when updated with a subchannel that is already READY', done => {
        const channelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(baseChannelControlHelper, {
            createSubchannel: (subchannelAddress, subchannelArgs) => {
                const subchannel = new common_1.MockSubchannel((0, subchannel_address_1.subchannelAddressToString)(subchannelAddress), connectivity_state_1.ConnectivityState.READY);
                subchannels.push(subchannel);
                return subchannel;
            },
            updateState: updateStateCallBackForExpectedStateSequence([connectivity_state_1.ConnectivityState.READY], done),
        });
        const pickFirst = new load_balancer_pick_first_1.PickFirstLoadBalancer(channelControlHelper);
        pickFirst.updateAddressList([{ host: 'localhost', port: 1 }], config);
    });
    it('Should stay CONNECTING if only some subchannels fail to connect', done => {
        const channelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(baseChannelControlHelper, {
            updateState: updateStateCallBackForExpectedStateSequence([connectivity_state_1.ConnectivityState.CONNECTING], done),
        });
        const pickFirst = new load_balancer_pick_first_1.PickFirstLoadBalancer(channelControlHelper);
        pickFirst.updateAddressList([
            { host: 'localhost', port: 1 },
            { host: 'localhost', port: 2 },
        ], config);
        process.nextTick(() => {
            subchannels[0].transitionToState(connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE);
        });
    });
    it('Should enter TRANSIENT_FAILURE when subchannels fail to connect', done => {
        const channelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(baseChannelControlHelper, {
            updateState: updateStateCallBackForExpectedStateSequence([connectivity_state_1.ConnectivityState.CONNECTING, connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE], done),
        });
        const pickFirst = new load_balancer_pick_first_1.PickFirstLoadBalancer(channelControlHelper);
        pickFirst.updateAddressList([
            { host: 'localhost', port: 1 },
            { host: 'localhost', port: 2 },
        ], config);
        process.nextTick(() => {
            subchannels[0].transitionToState(connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE);
        });
        process.nextTick(() => {
            subchannels[1].transitionToState(connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE);
        });
    });
    it('Should stay in TRANSIENT_FAILURE if subchannels go back to CONNECTING', done => {
        const channelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(baseChannelControlHelper, {
            updateState: updateStateCallBackForExpectedStateSequence([connectivity_state_1.ConnectivityState.CONNECTING, connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE], done),
        });
        const pickFirst = new load_balancer_pick_first_1.PickFirstLoadBalancer(channelControlHelper);
        pickFirst.updateAddressList([
            { host: 'localhost', port: 1 },
            { host: 'localhost', port: 2 },
        ], config);
        process.nextTick(() => {
            subchannels[0].transitionToState(connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE);
            process.nextTick(() => {
                subchannels[1].transitionToState(connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE);
                process.nextTick(() => {
                    subchannels[0].transitionToState(connectivity_state_1.ConnectivityState.CONNECTING);
                    process.nextTick(() => {
                        subchannels[1].transitionToState(connectivity_state_1.ConnectivityState.CONNECTING);
                    });
                });
            });
        });
    });
    it('Should immediately enter TRANSIENT_FAILURE if subchannels start in TRANSIENT_FAILURE', done => {
        const channelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(baseChannelControlHelper, {
            createSubchannel: (subchannelAddress, subchannelArgs) => {
                const subchannel = new common_1.MockSubchannel((0, subchannel_address_1.subchannelAddressToString)(subchannelAddress), connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE);
                subchannels.push(subchannel);
                return subchannel;
            },
            updateState: updateStateCallBackForExpectedStateSequence([connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE], done),
        });
        const pickFirst = new load_balancer_pick_first_1.PickFirstLoadBalancer(channelControlHelper);
        pickFirst.updateAddressList([
            { host: 'localhost', port: 1 },
            { host: 'localhost', port: 2 },
        ], config);
    });
    it('Should enter READY if a subchannel connects after entering TRANSIENT_FAILURE mode', done => {
        const channelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(baseChannelControlHelper, {
            createSubchannel: (subchannelAddress, subchannelArgs) => {
                const subchannel = new common_1.MockSubchannel((0, subchannel_address_1.subchannelAddressToString)(subchannelAddress), connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE);
                subchannels.push(subchannel);
                return subchannel;
            },
            updateState: updateStateCallBackForExpectedStateSequence([connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE, connectivity_state_1.ConnectivityState.READY], done),
        });
        const pickFirst = new load_balancer_pick_first_1.PickFirstLoadBalancer(channelControlHelper);
        pickFirst.updateAddressList([
            { host: 'localhost', port: 1 },
            { host: 'localhost', port: 2 },
        ], config);
        process.nextTick(() => {
            subchannels[0].transitionToState(connectivity_state_1.ConnectivityState.READY);
        });
    });
    it('Should stay in TRANSIENT_FAILURE after an address update with non-READY subchannels', done => {
        let currentStartState = connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE;
        const channelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(baseChannelControlHelper, {
            createSubchannel: (subchannelAddress, subchannelArgs) => {
                const subchannel = new common_1.MockSubchannel((0, subchannel_address_1.subchannelAddressToString)(subchannelAddress), currentStartState);
                subchannels.push(subchannel);
                return subchannel;
            },
            updateState: updateStateCallBackForExpectedStateSequence([connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE], done),
        });
        const pickFirst = new load_balancer_pick_first_1.PickFirstLoadBalancer(channelControlHelper);
        pickFirst.updateAddressList([
            { host: 'localhost', port: 1 },
            { host: 'localhost', port: 2 },
        ], config);
        process.nextTick(() => {
            currentStartState = connectivity_state_1.ConnectivityState.CONNECTING;
            pickFirst.updateAddressList([
                { host: 'localhost', port: 3 },
                { host: 'localhost', port: 4 },
            ], config);
        });
    });
    it('Should transition from TRANSIENT_FAILURE to READY after an address update with a READY subchannel', done => {
        let currentStartState = connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE;
        const channelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(baseChannelControlHelper, {
            createSubchannel: (subchannelAddress, subchannelArgs) => {
                const subchannel = new common_1.MockSubchannel((0, subchannel_address_1.subchannelAddressToString)(subchannelAddress), currentStartState);
                subchannels.push(subchannel);
                return subchannel;
            },
            updateState: updateStateCallBackForExpectedStateSequence([connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE, connectivity_state_1.ConnectivityState.READY], done),
        });
        const pickFirst = new load_balancer_pick_first_1.PickFirstLoadBalancer(channelControlHelper);
        pickFirst.updateAddressList([
            { host: 'localhost', port: 1 },
            { host: 'localhost', port: 2 },
        ], config);
        process.nextTick(() => {
            currentStartState = connectivity_state_1.ConnectivityState.READY;
            pickFirst.updateAddressList([{ host: 'localhost', port: 3 }], config);
        });
    });
    it('Should transition from READY to IDLE if the connected subchannel disconnects', done => {
        const currentStartState = connectivity_state_1.ConnectivityState.READY;
        const channelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(baseChannelControlHelper, {
            createSubchannel: (subchannelAddress, subchannelArgs) => {
                const subchannel = new common_1.MockSubchannel((0, subchannel_address_1.subchannelAddressToString)(subchannelAddress), currentStartState);
                subchannels.push(subchannel);
                return subchannel;
            },
            updateState: updateStateCallBackForExpectedStateSequence([connectivity_state_1.ConnectivityState.READY, connectivity_state_1.ConnectivityState.IDLE], done),
        });
        const pickFirst = new load_balancer_pick_first_1.PickFirstLoadBalancer(channelControlHelper);
        pickFirst.updateAddressList([{ host: 'localhost', port: 1 }], config);
        process.nextTick(() => {
            subchannels[0].transitionToState(connectivity_state_1.ConnectivityState.IDLE);
        });
    });
    it('Should transition from READY to CONNECTING if the connected subchannel disconnects after an update', done => {
        let currentStartState = connectivity_state_1.ConnectivityState.READY;
        const channelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(baseChannelControlHelper, {
            createSubchannel: (subchannelAddress, subchannelArgs) => {
                const subchannel = new common_1.MockSubchannel((0, subchannel_address_1.subchannelAddressToString)(subchannelAddress), currentStartState);
                subchannels.push(subchannel);
                return subchannel;
            },
            updateState: updateStateCallBackForExpectedStateSequence([connectivity_state_1.ConnectivityState.READY, connectivity_state_1.ConnectivityState.CONNECTING], done),
        });
        const pickFirst = new load_balancer_pick_first_1.PickFirstLoadBalancer(channelControlHelper);
        pickFirst.updateAddressList([{ host: 'localhost', port: 1 }], config);
        process.nextTick(() => {
            currentStartState = connectivity_state_1.ConnectivityState.IDLE;
            pickFirst.updateAddressList([{ host: 'localhost', port: 2 }], config);
            process.nextTick(() => {
                subchannels[0].transitionToState(connectivity_state_1.ConnectivityState.IDLE);
            });
        });
    });
    it('Should transition from READY to TRANSIENT_FAILURE if the connected subchannel disconnects and the update fails', done => {
        let currentStartState = connectivity_state_1.ConnectivityState.READY;
        const channelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(baseChannelControlHelper, {
            createSubchannel: (subchannelAddress, subchannelArgs) => {
                const subchannel = new common_1.MockSubchannel((0, subchannel_address_1.subchannelAddressToString)(subchannelAddress), currentStartState);
                subchannels.push(subchannel);
                return subchannel;
            },
            updateState: updateStateCallBackForExpectedStateSequence([connectivity_state_1.ConnectivityState.READY, connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE], done),
        });
        const pickFirst = new load_balancer_pick_first_1.PickFirstLoadBalancer(channelControlHelper);
        pickFirst.updateAddressList([{ host: 'localhost', port: 1 }], config);
        process.nextTick(() => {
            currentStartState = connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE;
            pickFirst.updateAddressList([{ host: 'localhost', port: 2 }], config);
            process.nextTick(() => {
                subchannels[0].transitionToState(connectivity_state_1.ConnectivityState.IDLE);
            });
        });
    });
    it('Should transition from READY to READY if a subchannel is connected and an update has a connected subchannel', done => {
        const currentStartState = connectivity_state_1.ConnectivityState.READY;
        const channelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(baseChannelControlHelper, {
            createSubchannel: (subchannelAddress, subchannelArgs) => {
                const subchannel = new common_1.MockSubchannel((0, subchannel_address_1.subchannelAddressToString)(subchannelAddress), currentStartState);
                subchannels.push(subchannel);
                return subchannel;
            },
            updateState: updateStateCallBackForExpectedStateSequence([connectivity_state_1.ConnectivityState.READY, connectivity_state_1.ConnectivityState.READY], done),
        });
        const pickFirst = new load_balancer_pick_first_1.PickFirstLoadBalancer(channelControlHelper);
        pickFirst.updateAddressList([{ host: 'localhost', port: 1 }], config);
        process.nextTick(() => {
            pickFirst.updateAddressList([{ host: 'localhost', port: 2 }], config);
            process.nextTick(() => {
                subchannels[0].transitionToState(connectivity_state_1.ConnectivityState.IDLE);
            });
        });
    });
    it('Should request reresolution every time each child reports TF', done => {
        let reresolutionRequestCount = 0;
        const targetReresolutionRequestCount = 3;
        const currentStartState = connectivity_state_1.ConnectivityState.IDLE;
        const channelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(baseChannelControlHelper, {
            createSubchannel: (subchannelAddress, subchannelArgs) => {
                const subchannel = new common_1.MockSubchannel((0, subchannel_address_1.subchannelAddressToString)(subchannelAddress), currentStartState);
                subchannels.push(subchannel);
                return subchannel;
            },
            updateState: updateStateCallBackForExpectedStateSequence([connectivity_state_1.ConnectivityState.CONNECTING, connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE], err => setImmediate(() => {
                assert.strictEqual(reresolutionRequestCount, targetReresolutionRequestCount);
                done(err);
            })),
            requestReresolution: () => {
                reresolutionRequestCount += 1;
            }
        });
        const pickFirst = new load_balancer_pick_first_1.PickFirstLoadBalancer(channelControlHelper);
        pickFirst.updateAddressList([{ host: 'localhost', port: 1 }], config);
        process.nextTick(() => {
            subchannels[0].transitionToState(connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE);
            process.nextTick(() => {
                pickFirst.updateAddressList([{ host: 'localhost', port: 2 }], config);
                process.nextTick(() => {
                    subchannels[1].transitionToState(connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE);
                    process.nextTick(() => {
                        pickFirst.updateAddressList([{ host: 'localhost', port: 3 }], config);
                        process.nextTick(() => {
                            subchannels[2].transitionToState(connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE);
                        });
                    });
                });
            });
        });
    });
    it('Should request reresolution if the new subchannels are already in TF', done => {
        let reresolutionRequestCount = 0;
        const targetReresolutionRequestCount = 3;
        const currentStartState = connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE;
        const channelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(baseChannelControlHelper, {
            createSubchannel: (subchannelAddress, subchannelArgs) => {
                const subchannel = new common_1.MockSubchannel((0, subchannel_address_1.subchannelAddressToString)(subchannelAddress), currentStartState);
                subchannels.push(subchannel);
                return subchannel;
            },
            updateState: updateStateCallBackForExpectedStateSequence([connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE], err => setImmediate(() => {
                assert.strictEqual(reresolutionRequestCount, targetReresolutionRequestCount);
                done(err);
            })),
            requestReresolution: () => {
                reresolutionRequestCount += 1;
            }
        });
        const pickFirst = new load_balancer_pick_first_1.PickFirstLoadBalancer(channelControlHelper);
        pickFirst.updateAddressList([{ host: 'localhost', port: 1 }], config);
        process.nextTick(() => {
            pickFirst.updateAddressList([{ host: 'localhost', port: 2 }], config);
            process.nextTick(() => {
                pickFirst.updateAddressList([{ host: 'localhost', port: 2 }], config);
            });
        });
    });
    it('Should reconnect to the same address list if exitIdle is called', done => {
        const currentStartState = connectivity_state_1.ConnectivityState.READY;
        const channelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(baseChannelControlHelper, {
            createSubchannel: (subchannelAddress, subchannelArgs) => {
                const subchannel = new common_1.MockSubchannel((0, subchannel_address_1.subchannelAddressToString)(subchannelAddress), currentStartState);
                subchannels.push(subchannel);
                return subchannel;
            },
            updateState: updateStateCallBackForExpectedStateSequence([connectivity_state_1.ConnectivityState.READY, connectivity_state_1.ConnectivityState.IDLE, connectivity_state_1.ConnectivityState.READY], done),
        });
        const pickFirst = new load_balancer_pick_first_1.PickFirstLoadBalancer(channelControlHelper);
        pickFirst.updateAddressList([{ host: 'localhost', port: 1 }], config);
        process.nextTick(() => {
            subchannels[0].transitionToState(connectivity_state_1.ConnectivityState.IDLE);
            process.nextTick(() => {
                pickFirst.exitIdle();
            });
        });
    });
    describe('Address list randomization', () => {
        const shuffleConfig = new load_balancer_pick_first_1.PickFirstLoadBalancingConfig(true);
        it('Should pick different subchannels after multiple updates', done => {
            const pickedSubchannels = new Set();
            const channelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(baseChannelControlHelper, {
                createSubchannel: (subchannelAddress, subchannelArgs) => {
                    const subchannel = new common_1.MockSubchannel((0, subchannel_address_1.subchannelAddressToString)(subchannelAddress), connectivity_state_1.ConnectivityState.READY);
                    subchannels.push(subchannel);
                    return subchannel;
                },
                updateState: (connectivityState, picker) => {
                    if (connectivityState === connectivity_state_1.ConnectivityState.READY) {
                        const pickedSubchannel = picker.pick({
                            extraPickInfo: {},
                            metadata: new metadata_1.Metadata(),
                        }).subchannel;
                        if (pickedSubchannel) {
                            pickedSubchannels.add(pickedSubchannel.getAddress());
                        }
                    }
                },
            });
            const addresses = [];
            for (let i = 0; i < 10; i++) {
                addresses.push({ host: 'localhost', port: i + 1 });
            }
            const pickFirst = new load_balancer_pick_first_1.PickFirstLoadBalancer(channelControlHelper);
            /* Pick from 10 subchannels 5 times, with address randomization enabled,
             * and verify that at least two different subchannels are picked. The
             * probability choosing the same address every time is 1/10,000, which
             * I am considering an acceptable flake rate */
            pickFirst.updateAddressList(addresses, shuffleConfig);
            process.nextTick(() => {
                pickFirst.updateAddressList(addresses, shuffleConfig);
                process.nextTick(() => {
                    pickFirst.updateAddressList(addresses, shuffleConfig);
                    process.nextTick(() => {
                        pickFirst.updateAddressList(addresses, shuffleConfig);
                        process.nextTick(() => {
                            pickFirst.updateAddressList(addresses, shuffleConfig);
                            process.nextTick(() => {
                                assert(pickedSubchannels.size > 1);
                                done();
                            });
                        });
                    });
                });
            });
        });
        it('Should pick the same subchannel if address randomization is disabled', done => {
            /* This is the same test as the previous one, except using the config
             * that does not enable address randomization. In this case, false
             * positive probability is 1/10,000. */
            const pickedSubchannels = new Set();
            const channelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(baseChannelControlHelper, {
                createSubchannel: (subchannelAddress, subchannelArgs) => {
                    const subchannel = new common_1.MockSubchannel((0, subchannel_address_1.subchannelAddressToString)(subchannelAddress), connectivity_state_1.ConnectivityState.READY);
                    subchannels.push(subchannel);
                    return subchannel;
                },
                updateState: (connectivityState, picker) => {
                    if (connectivityState === connectivity_state_1.ConnectivityState.READY) {
                        const pickedSubchannel = picker.pick({
                            extraPickInfo: {},
                            metadata: new metadata_1.Metadata(),
                        }).subchannel;
                        if (pickedSubchannel) {
                            pickedSubchannels.add(pickedSubchannel.getAddress());
                        }
                    }
                },
            });
            const addresses = [];
            for (let i = 0; i < 10; i++) {
                addresses.push({ host: 'localhost', port: i + 1 });
            }
            const pickFirst = new load_balancer_pick_first_1.PickFirstLoadBalancer(channelControlHelper);
            pickFirst.updateAddressList(addresses, config);
            process.nextTick(() => {
                pickFirst.updateAddressList(addresses, config);
                process.nextTick(() => {
                    pickFirst.updateAddressList(addresses, config);
                    process.nextTick(() => {
                        pickFirst.updateAddressList(addresses, config);
                        process.nextTick(() => {
                            pickFirst.updateAddressList(addresses, config);
                            process.nextTick(() => {
                                assert(pickedSubchannels.size === 1);
                                done();
                            });
                        });
                    });
                });
            });
        });
        describe('End-to-end functionality', () => {
            const serviceConfig = {
                methodConfig: [],
                loadBalancingConfig: [
                    {
                        pick_first: {
                            shuffleAddressList: true,
                        },
                    },
                ],
            };
            let server;
            let client;
            before(async () => {
                server = new common_1.TestServer(false);
                await server.start();
                client = new common_1.TestClient(server.port, false, {
                    'grpc.service_config': JSON.stringify(serviceConfig),
                });
            });
            after(() => {
                client.close();
                server.shutdown();
            });
            it('Should still work with shuffleAddressList set', done => {
                client.sendRequest(error => {
                    done(error);
                });
            });
        });
    });
});
//# sourceMappingURL=test-pick-first.js.map