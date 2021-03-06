import { APIGatewayProxyHandler } from 'aws-lambda';
import { path, pipe, prop } from 'ramda';
import { LevelData } from '../models';
import { updateLevelData } from './../app/controllers/game-management/game-management';

export const updateLevelsHandler: APIGatewayProxyHandler = async (event) => {
  const gameId = pipe(path(['pathParameters', 'proxy']), parseInt)(event);
  const levels = pipe(prop('body'), JSON.parse)(event) as LevelData[];
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
