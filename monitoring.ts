import { APIGatewayProxyHandler } from 'aws-lambda';
import { pipe, path, isNil } from 'ramda';
import { getMonitoringData } from './modules/game-management';

export const monitoringHandler: APIGatewayProxyHandler = async (event, context, callback) => {
  const gameId = pipe(
    path(['queryStringParameters', 'id']),
    parseInt
  )(event);
  const domain = path(['queryStringParameters', 'domain'], event);

  if (isNil(gameId) || isNil(domain)) {
    return {
      statusCode: 400,
      body: 'Bad Request',
    };
  }
  try {
    const gameData = await getMonitoringData({ gameId, domain });
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(gameData),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify(error),
    };
  }
};
