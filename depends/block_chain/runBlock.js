const util = require("../utils");
const async = require("async");

const rlp = util.rlp;
const BN = util.BN;
const Buffer = util.Buffer;

/**
 * Process the transactions in an block
 * @param {Object} opts
 * @prop {Block} opts.block - the block we are processing
 * @prop {Buffer} opts.root - the parent block stateRoot
 * @prop {Boolean} opts.generate - whether to generate the stateRoot
 * @prop {Boolean} opts.skipNonce - if ignore transaction nonce check
 * @prop {Boolean} opts.skipBalance - if ignore transaction balance check
 * @return {Object} 
 * @prop {Number} state
 * @prop {String} msg
 * @prop {Array} transactions  
 */
module.exports = async function(opts) {
  const block = opts.block;
  const ifGenerateStateRoot = opts.generate || false;
  const validateStateRoot = !ifGenerateStateRoot;

  let failedTransactions = [];
  let errors = [];

  if(opts.root)
  {
    this.stateManager.initTrie(opts.root);
  }

  // populate cache
  let addresses = [];
  for(let i = 0; i < block.transactions.length; i++)
  {
    let tx = block.transactions[i];

    try
    {
      addresses.push(tx.from);
    }
    catch(e)
    {
      await Promise.reject(`runBlock, trasaction ${tx.hash(true).toString("hex")}'s property from is invalid`);
    }
    addresses.push(tx.to);
  }

  // delete same ele
  addresses = [...new Set(addresses)];
  await this.stateManager.warmCache(addresses);


  // process transactions
  for(let i = 0; i < block.transactions.length; i++)
  {
    let transaction = block.transactions[i];
    try
    {
      await this.runTx({
        tx: transaction,
        skipNonce: opts.skipNonce,
        skipBalance: opts.skipBalance
      });
    }
    catch(e)
    {
      errors.push(e);
      failedTransactions.push(transaction);
    }
  }

  if(failedTransactions.length > 0)
  {
    return {
      state: false,
      msg: `runBlock, some transactions is invalid\r\n${errors.join("\r\n")}`,
      transactions: failedTransactions
    };
  }

  // flush state to db
  this.stateManager.checkpoint();
  await this.stateManager.flushCache();
  if(ifGenerateStateRoot)
  {
    block.header.stateRoot = this.stateManager.getTrieRoot();
  }     
  // check state trie
  if(validateStateRoot && this.stateManager.getTrieRoot().toString("hex") !== block.header.stateRoot.toString("hex"))
  {
    await Promise.reject(`runBlock, stateTrie should be ${this.stateManager.getTrieRoot().toString("hex")}, now is ${block.header.stateRoot.toString("hex")}`);
  }

  await this.stateManager.commit();
  this.stateManager.clearCache();

  return {
    state: true,
    msg: "",
    transactions: []
  }
}
