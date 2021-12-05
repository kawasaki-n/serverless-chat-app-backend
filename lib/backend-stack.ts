import * as cdk from '@aws-cdk/core';
import { AttributeType, BillingMode, Table } from '@aws-cdk/aws-dynamodb';
import { WebSocketApi, WebSocketStage } from '@aws-cdk/aws-apigatewayv2';
import { NodejsFunction } from '@aws-cdk/aws-lambda-nodejs';
import { LambdaWebSocketIntegration } from '@aws-cdk/aws-apigatewayv2-integrations';
import { Runtime } from '@aws-cdk/aws-lambda';
import { Duration, RemovalPolicy } from '@aws-cdk/core';
import { Effect, PolicyStatement, Role, ServicePrincipal } from '@aws-cdk/aws-iam';

export class BackendStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const db = new Table(this, 'ChatAppDb', {
      partitionKey: {
        name: 'connectionId',
        type: AttributeType.STRING,
      },
      tableName: 'ChatAppDb',
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const connectHandler = new NodejsFunction(this, 'ConnectHandlerFunction', {
      entry: 'src/handler/connect.ts',
      runtime: Runtime.NODEJS_14_X,
      handler: 'handler',
      environment: {
        TABLE_NAME: db.tableName,
      },
      memorySize: 128,
      timeout: Duration.seconds(30),
    });
    db.grantReadWriteData(connectHandler);

    const disconnectHandler = new NodejsFunction(this, 'DisconnectHandlerFunction', {
      entry: 'src/handler/disconnect.ts',
      runtime: Runtime.NODEJS_14_X,
      handler: 'handler',
      environment: {
        TABLE_NAME: db.tableName,
      },
      memorySize: 128,
      timeout: Duration.seconds(30),
    });
    db.grantReadWriteData(disconnectHandler);

    const messageHandler = new NodejsFunction(this, 'MessageHandlerFunction', {
      entry: 'src/handler/message.ts',
      runtime: Runtime.NODEJS_14_X,
      handler: 'handler',
      environment: {
        TABLE_NAME: db.tableName,
      },
      memorySize: 128,
      timeout: Duration.seconds(30),
    });
    db.grantReadWriteData(messageHandler);

    const api = new WebSocketApi(this, 'ChatWebSocketApi', {
      connectRouteOptions: {
        integration: new LambdaWebSocketIntegration({ handler: connectHandler }),
      },
      disconnectRouteOptions: {
        integration: new LambdaWebSocketIntegration({ handler: disconnectHandler }),
      },
      defaultRouteOptions: {
        integration: new LambdaWebSocketIntegration({ handler: messageHandler }),
      },
    });
    const stage = new WebSocketStage(this, 'DevStage', {
      webSocketApi: api,
      stageName: 'dev',
      autoDeploy: true,
    });

    const policy = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: [
        this.formatArn({
          service: 'execute-api',
          resourceName: `${stage.stageName}/POST/*`,
          resource: api.apiId,
        }),
      ],
      actions: ['execute-api:ManageConnections'],
    });
    messageHandler.addToRolePolicy(policy);
  }
}
