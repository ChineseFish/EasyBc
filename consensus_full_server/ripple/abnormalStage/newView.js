const NewView = require("../data/newView");
const ViewChange = require("../data/viewChange");
const utils = require("../../../depends/utils");
const assert = require("assert");
const { RIPPLE_STATE_NEW_VIEW,
  PROTOCOL_CMD_NEW_VIEW_REQ,
  PROTOCOL_CMD_NEW_VIEW_RES,
  STAGE_STATE_EMPTY,
  STAGE_STATE_PROCESSING,
  STAGE_VIEW_CHANGE_NEW_VIEW_EXPIRATION } = require("../../constant");
const LeaderStage = require("../stage/leaderStage");

const rlp = utils.rlp;
const sha256 = utils.sha256;

const p2p = process[Symbol.for("p2p")];
const logger = process[Symbol.for("loggerConsensus")];
const privateKey = process[Symbol.for("privateKey")];
const unlManager = process[Symbol.for("unlManager")];

class NewView extends LeaderStage {
  constructor(ripple) {

    super({ name: 'newView', expiraion: STAGE_VIEW_CHANGE_NEW_VIEW_EXPIRATION })

    this.ripple = ripple;
  }

  run() {
    if (this.state !== STAGE_STATE_EMPTY) {
      logger.fatal(`NewView run, state should be ${STAGE_STATE_EMPTY}, now is ${this.state}, ${process[Symbol.for("getStackInfo")]()}`);

      process.exit(1);
    }

    //
    this.state = STAGE_STATE_PROCESSING;

    //
    this.ripple.state = RIPPLE_STATE_NEW_VIEW;

    // node is leader
    if (this.ripple.checkPrimaryNode(process[Symbol.for("address")])) {
      const viewChanges = [];
      for (let viewChange of this.ripple.viewChangeForTimeout.trimedViewChangesByAddress)
      {
        viewChanges.push(viewChange.serialize());
      }

      //
      const newView = new NewView({
        hash: this.ripple.viewChangeForTimeout.consensusViewChange.hash,
        number: this.ripple.viewChangeForTimeout.consensusViewChange.number,
        hash: this.ripple.viewChangeForTimeout.consensusViewChange.hash,
        viewChanges: rlp.encode(viewChanges)
      });

      // broadcast amalgamated transactions
      p2p.sendAll(PROTOCOL_CMD_NEW_VIEW_REQ, newView.serialize())

      // begin timer
      this.startTimer()
    }
  }

  handler() {
    this.ripple.run();
  }

	/**
	 * @param {Buffer} address
	 * @param {Number} cmd
	 * @param {Buffer} data
	 */
  handleMessage(address, cmd, data) {
    assert(Buffer.isBuffer(address), `NewView handleMessage, address should be an Buffer, now is ${typeof address}`);
    assert(typeof cmd === "number", `NewView handleMessage, cmd should be a Number, now is ${typeof cmd}`);
    assert(Buffer.isBuffer(data), `NewView handleMessage, data should be an Buffer, now is ${typeof data}`);

    switch (cmd) {
      case PROTOCOL_CMD_NEW_VIEW_REQ:
        {
          const newView = new NewView(data);
          
          const viewChanges = rlp.decode(newView.viewChanges).map(viewChange => new ViewChange(viewChange));

          // check size
          if (viewChanges.length < unlManager.threshould)
          {
            return;
          }

          // check view change
          const trimedViewChangesByAddress = new Set();
          let viewChangeHash;
          for(let viewChange of viewChanges)
          {
            // check if same
            if (!viewChangeHash)
            {
              viewChangeHash = viewChange.hash(false).toString('hex');
            }
            else
            {
              if (viewChangeHash !== viewChange.hash(false).toString('hex'))
              {
                return;
              }
            }

            //
            if(!viewChange.validate())
            {
              return;
            }

            // check repeat
            const fromAddress = viewChange.from.toString('hex');
            if (trimedViewChangesByAddress.has(fromAddress))
            {
              return;
            }
          }

          // 
          this.ripple.view = new BN(viewChanges[0].view).addn(1).toBuffer();

          //
          let candidate = new Candidate({
            hash: this.ripple.hash,
            number: this.ripple.number,
            view: this.ripple.view
          });

          //
          candidate.sign(privateKey);

          p2p.send(address, PROTOCOL_CMD_NEW_VIEW_RES, candidate.serialize());
        }
        break;
      case PROTOCOL_CMD_NEW_VIEW_RES:
        {
          if (this.state !== STAGE_STATE_PROCESSING) {
            logger.info(`NewView handleMessage, state should be ${STAGE_STATE_PROCESSING}, now is ${this.state}`);

            return;
          }

          if (this.ripple.checkPrimaryNode(process[Symbol.for("address")])) {
            this.validateAndProcessExchangeData(new Candidate(data), address.toString('hex'));
          }
        }
        break;
    }
  }
}

module.exports = NewView;