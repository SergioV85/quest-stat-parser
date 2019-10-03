import { APIGatewayProxyHandler } from 'aws-lambda';
import { path, pipe, prop } from 'ramda';
import { updateLevelData } from './modules/game-management';

export const updateLevelsHandler: APIGatewayProxyHandler = async (event, context, callback) => {
  const gameId = path(['pathParameters', 'proxy'], event);
  const levels = pipe(
    prop('body'),
    JSON.parse
  )(event);
  try {
    const updateLevelStat = await updateLevelData({ gameId, levels });
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(updateLevelStat),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify(error),
    };
  }
};
