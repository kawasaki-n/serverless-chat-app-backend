import { APIGatewayProxyEvent, APIGatewayProxyResultV2, Handler } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const apigateway = (domainName: any, stage: any): AWS.ApiGatewayManagementApi =>
  new AWS.ApiGatewayManagementApi({ endpoint: `${domainName}/${stage}` });
const client = new AWS.DynamoDB.DocumentClient();

export const handler: Handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResultV2> => {
  console.log('start message handler');
  try {
    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
      throw new Error('tableName not specified in process.env.TABLE_NAME');
    }

    const scanParams: AWS.DynamoDB.Types.ScanInput = {
      TableName: tableName,
      ProjectionExpression: 'connectionId',
    };
    const connectionIds = await client.scan(scanParams).promise();
    const items = await Promise.all(connectionIds.Items || []);
    console.log('items ', items);
    items.map(async ({ connectionId }) => {
      try {
        const sendParams: AWS.ApiGatewayManagementApi.Types.PostToConnectionRequest = {
          ConnectionId: connectionId,
          Data: JSON.parse(event.body || '').data,
        };
        await apigateway(event.requestContext.domainName, event.requestContext.stage)
          .postToConnection(sendParams)
          .promise();
      } catch (e: any) {
        if (e.statusCode === 410) {
          console.log('Found stale connection, deleting ' + connectionId);
          await client
            .delete({
              TableName: tableName,
              Key: { connectionId: connectionId },
            })
            .promise();
        } else {
          throw e;
        }
      }
    });
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify(error),
    };
  }
  return {
    statusCode: 200,
  };
};
