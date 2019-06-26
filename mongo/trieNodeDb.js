const trieNodeSchema = require("./trieNode")
const assert = require("assert");

class TrieNodeDb
{
  constructor(mongooseInstance)
  {
    this.TrieNode = mongooseInstance.model('TrieNode', trieNodeSchema);
  }

  /**
   * @param {Buffer} key
   * @param {Function} cb
   */
  get(key, options, cb)
  {
    this.TrieNode.findOne({
      hash: key.toString("hex")
    },
    'data',
    {
      lean: true
    }, (err, result) => {
      if(!!err)
      {
        return cb(`TrieNodeDb get, throw exception ${e}`)
      }

      if(result)
      {
        return cb(null, Buffer.from(result.data, "hex"));
      }
      
      cb(`TrieNodeDb get, key ${key.toString('hex')} has no corresponding value}`);
    })
  }

  /**
   * @param {Buffer} key
   * @param {Buffer} val
   * @param {Function} cb
   */
  put(key, val, options, cb)
  {
    this.TrieNode.create({
      hash: key.toString("hex"),
      data: val.toString("hex")
    }).then(() => {
      cb()
    }).catch(e => {
      cb(`TrieNodeDb put, throw exception ${e}`)
    })
  }

  /**
   * @param {Buffer} key
   * @param {Function} cb
   */
  del(key, options, cb)
  {
    this.TrieNode.remove({
      hash: key.toString("hex")
    }, e => {
      if(!!e)
      {
        return cb(`TrieNodeDb del, trhow exception ${e}`)
      }

      cb()
    }) 
  }

  /**
   * @param {Array} opStack
   * @param {Function} cb
   */
  batch(opStack, options, cb)
  {
    opStack = opStack.map(op => {
      return {
        hash: op.key.toString("hex"),
        data: op.value.toString("hex")
      }
    });

    this.TrieNode.create(opStack).then(() => {
      cb()
    }).catch(e => {
      cb(e)
    })
  }
}

module.exports = TrieNodeDb;