import { APIGatewayProxyHandler } from 'aws-lambda';
import { pipe, path, pathOr, isNil } from 'ramda';
import { getGameData } from './../app/controllers/game-management/game-management';

export const gameDetailsHandler: APIGatewayProxyHandler = async event => {
  const gameId: number = pipe(
    path(['queryStringParameters', 'id']),
    parseInt,
  )(event);
  const domain: string = path(['queryStringParameters', 'domain'], event) as string;
  const isForceRefresh: boolean = pathOr(false, ['queryStringParameters', 'force'], event);

  if (isNil(gameId) || isNil(domain)) {
    return {
      statusCode: 400,
      body: 'Bad Request',
    };
  }
  return getGameData({ gameId, domain, isForceRefresh })
    .then(gameData => ({
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(gameData),
    }))
    .catch(error => ({
      statusCode: 500,
      body: JSON.stringify(error),
    }));
};
