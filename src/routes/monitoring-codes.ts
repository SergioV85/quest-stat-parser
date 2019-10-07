import { APIGatewayProxyHandler } from 'aws-lambda';
import { pipe, path, unless, isNil } from 'ramda';
import { getMonitoringCodes } from './../app/controllers/game-management/game-management';

export const monitoringCodesHandler: APIGatewayProxyHandler = async event => {
  const gameId = pipe(
    path(['queryStringParameters', 'gameId']),
    parseInt,
  )(event);
  const levelId = pipe(
    path(['queryStringParameters', 'levelId']),
    parseInt,
  )(event);
  const playerId = pipe(
    path(['queryStringParameters', 'playerId']),
    unless(isNil, parseInt),
  )(event);
  const teamId = pipe(
    path(['queryStringParameters', 'teamId']),
    unless(isNil, parseInt),
  )(event);
  const detailsType: string = path(['queryStringParameters', 'type'], event) as string;

  if (isNil(gameId)) {
    return {
      statusCode: 400,
      body: 'Bad Request',
    };
  }
  try {
    const gameData = await getMonitoringCodes({ gameId, playerId, levelId, teamId, detailsType });
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
