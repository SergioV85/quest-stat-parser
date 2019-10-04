import { APIGatewayProxyHandler } from 'aws-lambda';
import { pipe, path, unless, isNil } from 'ramda';
import { getMonitoringDetails } from './../app/controllers/game-management/game-management';

export const monitoringDetailsHandler: APIGatewayProxyHandler = async event => {
  const gameId = pipe(
    path(['queryStringParameters', 'gameId']),
    parseInt,
  )(event);
  const teamId = pipe(
    path(['queryStringParameters', 'teamId']),
    unless(isNil, parseInt),
  )(event);
  const playerId = pipe(
    path(['queryStringParameters', 'playerId']),
    unless(isNil, parseInt),
  )(event);
  const detailsType: string = path(['queryStringParameters', 'detailsLevel'], event) as string;

  if (isNil(gameId)) {
    return {
      statusCode: 400,
      body: 'Bad Request',
    };
  }
  try {
    const gameData = await getMonitoringDetails({ gameId, teamId, playerId, detailsType });
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
