const tape = require('tape');
const utils = require("../../depends/utils");
const { COMMAND_DYNAMIC_CREATE,
  COMMAND_DYNAMIC_UPDATE } = require("../constant");
const Transaction = require("../../depends/transaction");
const { getAccountInfo, sendTransaction } = require("../../toolkit/profile/utils");
const { randomBytes } = require("crypto");
const fs = require("fs");
const path = require("path");

const Buffer = utils.Buffer;
const intToBuffer = utils.intToBuffer;
const rlp = utils.rlp;
const BN = utils.BN;

const url = "http://localhost:8081";

const fromAccountKeyPair = {
  privateKey: "9d6ae99d516fec86d7c922d2b3b455205b25cc65d2467d8ecbc47d513cba3841",
  address: "14f8d8e6e23fecd75b4145a4b71a40ba4c9e7739"
}
const toAccountAddress = randomBytes(20);
const codeAccountAddress = randomBytes(20);

console.info(`toAccountAddress: ${toAccountAddress.toString('hex')}`);
console.info(`codeAccountAddress: ${codeAccountAddress.toString('hex')}`);


const gambleCode = fs.readFileSync(path.join(__dirname, "./gamble.js"), {
  encoding: 'utf8'
});

tape('testing dynamic constract opt', function (tester) {
  
  const it = tester.test
  let fromAccount;

  it('create dynamic constract', function (t) {

    (async () => {
      fromAccount = await getAccountInfo(url, fromAccountKeyPair.address)

      // construct a tx
      const tx = new Transaction({
        to: toAccountAddress,
        value: 1,
        timestamp: Date.now(),
        nonce: new BN(fromAccount.nonce).addn(1).toBuffer(),
        data: rlp.encode([intToBuffer(COMMAND_DYNAMIC_CREATE), codeAccountAddress, Buffer.from(gambleCode)])
      });

      // sign
      tx.sign(Buffer.from(fromAccountKeyPair.privateKey, 'hex'));

      //
      await sendTransaction(url, tx.serialize().toString('hex'));
    })().then(() => {
      t.end();
    }).catch(e => {
      t.error(e);
    })    
  });

  it('bet 100', function (t) {
    (async () => {
      // construct a tx
      const tx = new Transaction({
        to: toAccountAddress,
        value: 100,
        timestamp: Date.now(),
        nonce: new BN(fromAccount.nonce).addn(2).toBuffer(),
        data: rlp.encode([intToBuffer(COMMAND_DYNAMIC_UPDATE), intToBuffer(1)])
      });

      // sign
      tx.sign(Buffer.from(fromAccountKeyPair.privateKey, 'hex'));

      //
      await sendTransaction(url, tx.serialize().toString('hex'));
    })().then(() => {
      t.end();
    }).catch(e => {
      t.error(e);
    })    
  })

  it('bet 200', function (t) {
    (async () => {
      // construct a tx
      const tx = new Transaction({
        to: toAccountAddress,
        value: 100,
        timestamp: Date.now(),
        nonce: new BN(fromAccount.nonce).addn(3).toBuffer(),
        data: rlp.encode([intToBuffer(COMMAND_DYNAMIC_UPDATE), intToBuffer(1)])
      });

      // sign
      tx.sign(Buffer.from(fromAccountKeyPair.privateKey, 'hex'));

      //
      await sendTransaction(url, tx.serialize().toString('hex'));
    })().then(() => {
      t.end();
    }).catch(e => {
      t.error(e);
    });
  })

  it('draw', function (t) {
    (async () => {

      await new Promise(resolve => {
        setTimeout(() => {
          resolve();
        }, 8000);
      })

      // construct a tx
      const tx = new Transaction({
        to: toAccountAddress,
        value: 500,
        timestamp: Date.now(),
        nonce: new BN(fromAccount.nonce).addn(4).toBuffer(),
        data: rlp.encode([intToBuffer(COMMAND_DYNAMIC_UPDATE), intToBuffer(2)])
      });

      // sign
      tx.sign(Buffer.from(fromAccountKeyPair.privateKey, 'hex'));

      //
      await sendTransaction(url, tx.serialize().toString('hex'));
    })().then(() => {
      t.end();
    }).catch(e => {
      t.error(e);
    });
  })
})