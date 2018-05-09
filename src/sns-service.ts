/*
 *  @license
 *    Copyright 2018 Brigham Young University
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */
import * as AWS from 'aws-sdk';
import {
    AccountConfig,
    BindContext,
    ConsumeEventsContext,
    DeployContext,
    IDeployContext,
    IPreDeployContext,
    PreDeployContext,
    ProduceEventsContext,
    ServiceConfig,
    ServiceContext,
    ServiceDeployer,
    UnDeployContext
} from 'handel-extension-api';
import {
    awsCalls,
    bindPhase,
    deletePhases,
    deployPhase,
    handlebars,
    preDeployPhase,
    tagging
} from 'handel-extension-support';
import { SnsServiceConfig } from './config-types';

const SERVICE_NAME = 'SNS';

export class SNSService implements ServiceDeployer {

    public readonly consumedDeployOutputTypes = [];
    public readonly producedDeployOutputTypes = [
        'environmentVariables',
        'policies'
    ];
    public readonly producedEventsSupportedServices = [
        'lambda',
        'sqs'
    ];
    public readonly supportsTagging = true;

    public check(serviceContext: ServiceContext<SnsServiceConfig>, dependenciesServiceContexts: Array<ServiceContext<ServiceConfig>>): string[] {
        const errors = [];

        if (serviceContext.params.subscriptions) {

            for (const subscription of serviceContext.params.subscriptions) {
                const allowedValues = ['http', 'https', 'email', 'email-json', 'sms'];

                if (!subscription.endpoint) { errors.push(`${SERVICE_NAME} - A subscription requires an 'endpoint' parameter`); }
                if (!subscription.protocol) { errors.push(`${SERVICE_NAME} - A subscription requires a 'protocol' parameter`); }
                else if (!allowedValues.includes(subscription.protocol)) { errors.push(`${SERVICE_NAME} - Protocol must be one of ${allowedValues.join(', ')}`); }
            }
        }
        return errors;
    }

    public async deploy(ownServiceContext: ServiceContext<ServiceConfig>, ownPreDeployContext: PreDeployContext, dependenciesDeployContexts: DeployContext[]): Promise<DeployContext> {
        const stackName = ownServiceContext.stackName();
        // tslint:disable-next-line:no-console
        console.log(`${SERVICE_NAME} - Deploying topic '${stackName}'`);

        const compiledSnsTemplate = await this.getCompiledSnsTemplate(stackName, ownServiceContext);
        const stackTags = tagging.getTags(ownServiceContext);
        const deployedStack = await deployPhase.deployCloudFormationStack(stackName, compiledSnsTemplate, [], true, SERVICE_NAME, 30, stackTags);
        // tslint:disable-next-line:no-console
        console.log(`${SERVICE_NAME} - Finished deploying topic '${stackName}'`);
        return this.getDeployContext(ownServiceContext, deployedStack);
    }

    public unDeploy(ownServiceContext: ServiceContext<SnsServiceConfig>): Promise<UnDeployContext> {
        return deletePhases.unDeployService(ownServiceContext, SERVICE_NAME);
    }

    private getCompiledSnsTemplate(stackName: string, serviceContext: ServiceContext<SnsServiceConfig>): Promise<string> {
        const handlebarsParams = {
            subscriptions: serviceContext.params.subscriptions,
            topicName: stackName
        };
        return handlebars.compileTemplate(`${__dirname}/sns-template.yml`, handlebarsParams);
    }

    private getDeployContext(serviceContext: ServiceContext<SnsServiceConfig>, cfStack: AWS.CloudFormation.Stack): DeployContext {
        const topicName = awsCalls.cloudFormation.getOutput('TopicName', cfStack);
        const topicArn = awsCalls.cloudFormation.getOutput('TopicArn', cfStack);
        if(!topicName || !topicArn) {
            throw new Error('Expected to receive topic name and ARN back from SNS service');
        }

        const deployContext = new DeployContext(serviceContext);

        // Env variables to inject into consuming services
        deployContext.addEnvironmentVariables({
            TOPIC_ARN: topicArn,
            TOPIC_NAME: topicName
        });

        // Policy to talk to this queue
        deployContext.policies.push({
            'Effect': 'Allow',
            'Action': [
                'sns:ConfirmSubscription',
                'sns:GetEndpointAttributes',
                'sns:GetPlatformApplicationAttributes',
                'sns:GetSMSAttributes',
                'sns:GetSubscriptionAttributes',
                'sns:GetTopicAttributes',
                'sns:ListEndpointsByPlatformApplication',
                'sns:ListPhoneNumbersOptedOut',
                'sns:ListSubscriptions',
                'sns:ListSubscriptionsByTopic',
                'sns:ListTopics',
                'sns:OptInPhoneNumber',
                'sns:Publish',
                'sns:Subscribe',
                'sns:Unsubscribe'
            ],
            'Resource': [
                topicArn
            ]
        });

        return deployContext;
    }
}
