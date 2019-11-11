const Candidate = require("../data/candidate");
const utils = require("../../../depends/utils");
const ConsensusStage = require("../stage/consensusStage");
const assert = require("assert");
const { RIPPLE_STATE_FETCH_PROCESS_STATE,
  PROTOCOL_CMD_PROCESS_STATE_REQ,
  PROTOCOL_CMD_PROCESS_STATE_RES,
  STAGE_STATE_EMPTY,
  STAGE_STATE_PROCESSING,
  RIPPLE_STATE_FETCH_PROCESS_STATE_EXPIRATION,
  STAGE_FINISH_SUCCESS } = require("../constants");

const Buffer = utils.Buffer;

const p2p = process[Symbol.for("p2p")];
const logger = process[Symbol.for("loggerConsensus")];
const unlManager = process[Symbol.for("unlManager")];

class FetchProcessState extends ConsensusStage {
  constructor(ripple) {
    super({ name: 'fetchProcessState', expiraion: RIPPLE_STATE_FETCH_PROCESS_STATE_EXPIRATION, threshould: parseInt(unlManager.fullUnl.length / 2) + 1 })

    this.ripple = ripple;
  }

  run() {
    if (this.state !== STAGE_STATE_EMPTY) {
      logger.fatal(`FetchProcessState run, state should be ${STAGE_STATE_EMPTY}, now is ${this.state}, ${process[Symbol.for("getStackInfo")]()}`);

      process.exit(1);
    }

    //
    this.state = STAGE_STATE_PROCESSING;

    //
    this.ripple.state = RIPPLE_STATE_FETCH_PROCESS_STATE;

    //
    const reqCandidate = new Candidate({
      sequence: this.ripple.sequence,
      hash: this.ripple.hash,
      number: this.ripple.number,
      timestamp: this.ripple.timestamp,
      view: this.ripple.view
    })

    // broadcast
    p2p.sendAll(PROTOCOL_CMD_PROCESS_STATE_REQ, reqCandidate.serialize());

    // begin timer
    this.startTimer();

    //
    this.validateAndProcessExchangeData(reqCandidate, process[Symbol.for("address")]);
  }

  /**
   * @param {Number} code 
   */
  handler(code) {
    //
    this.reset();

    //
    if (code === STAGE_FINISH_SUCCESS)
    {
      this.ripple.runNewConsensusRound();
    }
    else
    {
      //
      this.run();
    }
  }

  /**
 * @param {Buffer} address
 * @param {Number} cmd
 * @param {Buffer} data
 */
  handleMessage(address, cmd, data) {
    assert(Buffer.isBuffer(address), `FetchProcessState handleMessage, address should be an Buffer, now is ${typeof address}`);
    assert(typeof cmd === "number", `FetchProcessState handleMessage, cmd should be a Number, now is ${typeof cmd}`);
    assert(Buffer.isBuffer(data), `FetchProcessState handleMessage, data should be an Buffer, now is ${typeof data}`);

    switch (cmd) {
      case PROTOCOL_CMD_PROCESS_STATE_REQ:
        {
          // check req candidate
          const reqCandidate = new Candidate(data);
          if (!reqCandidate.validate()) {
            logger.error(`FetchProcessState handleMessage, address: ${address.toString('hex')}, reqCandidate validate failed`)

            return;
          }

          //
          let resCandidate = new Candidate({
            sequence: this.ripple.sequence,
            hash: this.ripple.hash,
            number: this.ripple.number,
            view: this.ripple.view,
          });
          resCandidate.sign(privateKey);

          //
          p2p.send(address, PROTOCOL_CMD_PROCESS_STATE_RES, resCandidate.serialize());

        }
        break;
      case PROTOCOL_CMD_PROCESS_STATE_RES:
        {
          if (this.state !== STAGE_STATE_PROCESSING) {
            logger.info(`FetchProcessState handleMessage, state should be ${STAGE_STATE_PROCESSING}, now is ${this.state}`);

            return;
          }

          this.validateAndProcessExchangeData(new Candidate(data), address.toString('hex'));
        }
        break;
    }
  }

  reset()
  {
    super.reset();

    //
    this.consensusProcessState = undefined;
  }
}

module.exports = FetchProcessState;