import { APIGatewayProxyEvent, APIGatewayProxyResultV2, Handler } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const client = new AWS.DynamoDB.DocumentClient();

export const handler: Handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResultV2> => {
  console.log('start connect handler');
  try {
    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
      throw new Error('tableName not specified in process.env.TABLE_NAME');
    }

    const params = {
      TableName: tableName,
      Item: {
        connectionId: event.requestContext.connectionId,
      },
    };

    const ret = await client.put(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify(ret),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify(error),
    };
  }
};
