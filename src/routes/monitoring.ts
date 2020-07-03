import { APIGatewayProxyHandler } from 'aws-lambda';
import { pipe, path, isNil } from 'ramda';
import { getMonitoringData } from './../app/controllers/game-management/game-management';

export const monitoringHandler: APIGatewayProxyHandler = async (event) => {
  const gameId = pipe(path(['queryStringParameters', 'id']), parseInt)(event);
  const domain: string = path(['queryStringParameters', 'domain'], event) as string;

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
