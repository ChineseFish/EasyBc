const mysqlConfig = require("../config.json").mysql;
const process = require('process');
const Sequelize = require('sequelize');
const accountModelConfig = require('./account');
const transactionsHistoryModelConfig = require('./transactionsHistory');
const nodeModelConfig = require("./node.js");

const logger = process[Symbol.for('dbLogger')] || console

class Model
{
  constructor()
  {
    this.sequelize = new Sequelize('transaction', mysqlConfig.user, mysqlConfig.password, {
      host: mysqlConfig.host,
      port: mysqlConfig.port,
      dialect: 'mysql',
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    });
  }

  async init()
  {
    this.Account = this.sequelize.define(...accountModelConfig);
    this.TransactionsHistory = this.sequelize.define(...transactionsHistoryModelConfig);
    this.Node = this.sequelize.define(...nodeModelConfig);

    await this.sequelize.authenticate();
    await this.sequelize.sync();
  }
}

module.exports = Model