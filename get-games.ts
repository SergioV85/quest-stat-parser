import { APIGatewayProxyHandler } from 'aws-lambda';
import { getSavedGames } from './modules/game-management';

export const gamesHandler: APIGatewayProxyHandler = async () =>
  getSavedGames()
    .then(games => ({
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(games),
    }))
    .catch(error => ({
      statusCode: 500,
      body: JSON.stringify(error),
    }));
