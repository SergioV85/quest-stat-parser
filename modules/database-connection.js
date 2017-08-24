const { Pool } = require('pg');
const url = require('url');

const params = url.parse(process.env.DATABASE_URL);
const auth = params.auth.split(':');

const config = {
  user: auth[0],
  password: auth[1],
  host: params.hostname,
  port: params.port,
  database: params.pathname.split('/')[1],
  ssl: true,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
};

const createConnection = () => new Pool(config);

exports.getGameInfoFromDatabase = (gameId) => {
  const connection = createConnection();

  return connection.query(`SELECT id, domain, name, start, timezone FROM quest.games WHERE id = ${gameId}`)
    .then((data) => data.rows)
    .catch((error) => {
      throw error.stack;
    });
};

exports.saveGameInfoToDatabase = ({ id, name, domain, start, timezone }) => {
  const connection = createConnection();

  return connection
    .query(`INSERT 
      INTO quest.games 
      (id, domain, name, start, timezone) 
      VALUES
      (${id}, '${domain}', '${name}', '${start}', '${timezone}')`)
    .then(() => ({ id, name, domain, start, timezone }))
    .catch((error) => {
      throw error.stack;
    });
};
