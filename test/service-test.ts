/*
 * Copyright 2018 Brigham Young University
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
import { expect } from 'chai';
import {
    AccountConfig,
    ConsumeEventsContext,
    DeployContext,
    PreDeployContext,
    ProduceEventsContext,
    ServiceContext,
    ServiceEventConsumer,
    ServiceType,
    UnDeployContext
} from 'handel-extension-api';
import { deletePhases, deployPhase } from 'handel-extension-support';
import 'mocha';
import * as sinon from 'sinon';
import { SnsServiceConfig } from '../src/config-types';
import { SNSService } from '../src/sns-service';
import accountConfig from './fake-account-config';

describe('sns service deployer', () => {
    let sandbox: sinon.SinonSandbox;
    let serviceContext: ServiceContext<SnsServiceConfig>;
    let serviceParams: SnsServiceConfig;
    const appName = 'FakeApp';
    const envName = 'FakeEnv';
    const serviceName = 'FakeService';
    const serviceType = 'sns';
    const snsServiceDeployer = new SNSService();

    beforeEach(async () => {
        serviceParams = {
            type: serviceType,
            subscriptions: [{
                protocol: 'http',
                endpoint: 'fakeendpoint'
            }]
        };
        serviceContext = new ServiceContext(appName, envName, serviceName, new ServiceType('snsExtension', serviceType), serviceParams, accountConfig);
        sandbox = sinon.sandbox.create();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('check', () => {
        it('should handle no subscriptions', () => {
            const errors = snsServiceDeployer.check(serviceContext, []);
            expect(errors).to.deep.equal([]);
        });
        it('should require an endpoint on a subscription', () => {
            delete serviceContext.params.subscriptions![0].endpoint;
            const errors = snsServiceDeployer.check(serviceContext, []);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include(`requires an 'endpoint'`);
        });
        it('should require a protocol on a subscription', () => {
            delete serviceContext.params.subscriptions![0].protocol;
            const errors = snsServiceDeployer.check(serviceContext, []);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include(`requires a 'protocol'`);
        });
        it('should require a valid protocol', () => {
            serviceContext.params.subscriptions![0].protocol = 'webhook';
            const errors = snsServiceDeployer.check(serviceContext, []);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include(`Protocol must be one of`);
        });
    });

    describe('deploy', () => {
        it('should deploy the topic', async () => {
            const topicName = 'FakeTopic';
            const topicArn = 'FakeArn';
            const ownPreDeployContext = new PreDeployContext(serviceContext);
            const deployStackStub = sandbox.stub(deployPhase, 'deployCloudFormationStack').returns(Promise.resolve({
                Outputs: [
                    {
                        OutputKey: 'TopicName',
                        OutputValue: topicName
                    },
                    {
                        OutputKey: 'TopicArn',
                        OutputValue: topicArn
                    }
                ]
            }));

            const deployContext = await snsServiceDeployer.deploy(serviceContext, ownPreDeployContext, []);
            expect(deployStackStub.callCount).to.equal(1);
            expect(deployContext).to.be.instanceof(DeployContext);

            const envPrefix = serviceName.toUpperCase();

            // Should have exported 2 env vars
            expect(deployContext.environmentVariables).to.have.property(`${envPrefix}_TOPIC_NAME`, topicName);
            expect(deployContext.environmentVariables).to.have.property(`${envPrefix}_TOPIC_ARN`, topicArn);

            // Should have exported 1 policy
            expect(deployContext.policies.length).to.equal(1); // Should have exported one policy
            expect(deployContext.policies[0].Resource[0]).to.equal(topicArn);
        });
    });

    describe('unDeploy', () => {
        it('should undeploy the stack', async () => {
            const unDeployStackStub = sandbox.stub(deletePhases, 'unDeployService').resolves(new UnDeployContext(serviceContext));

            const unDeployContext = await snsServiceDeployer.unDeploy(serviceContext);
            expect(unDeployContext).to.be.instanceof(UnDeployContext);
            expect(unDeployStackStub.callCount).to.equal(1);
        });
    });
});
