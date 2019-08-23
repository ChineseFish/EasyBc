const Block = require("../../depends/block")
const receiptTrie = process[Symbol.for('receiptTrie')];
const utils = require("../../depends/utils");
const sideChainConstractId = require("../../consensus_constracts/sideChainConstract").id

const rlp = utils.rlp;

const mysql = process[Symbol.for("mysql")];

/**
 * @param {Block} block 
 */
const parseReceipt = async (block) => {
  
  // init trie root
  receiptTrie.root = block.header.receiptRoot;

  // fetch receipts
  const receipts = [];
  await new Promise((resolve, reject) => {
    var stream = receiptTrie.createReadStream();
    stream.on('data', node => {
      receipts.push(node.value)
    })
    stream.on('end', () => {
      resolve();
    })

    stream.on('error', e => {
      reject(`parseReceipt getReceipts, throw exception, ${e}`)
    })
  });

  // parse
  for (let receipt of receipts)
  {
    await parse(receipt)
  }
}

/**
 * @param {Buffer} event 
 */
const parse = async event => {
  const rawDataArray = rlp.decode(event);
  const [id, , name] = rawDataArray;

  if (id.toString('hex') === sideChainConstractId)
  {
    rawDataArray.splice(0, 1);
    rawDataArray.splice(1, 1);

    if (name.toString() === 'CorssPayRequestEvent') {
      await mysql.saveCrossPayRequest(...rawDataArray);
    }
    else if (name.toString() === 'CorssPayEvent') {
      await mysql.saveCrossPay(...rawDataArray);
    }
  }
}

module.exports = parseReceipt;