import { getSavedGames } from './modules/game-management';
export const gamesHandler = (event, context, callback) => {
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
};
//# sourceMappingURL=get-games.js.map