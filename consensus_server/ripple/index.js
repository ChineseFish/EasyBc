const Amalgamate = require("./stage/amalgamate");
const CandidateAgreement = require("./stage/candidateAgreement");
const BlockAgreement = require("./stage/blockAgreement");
const { STAGE_MAX_FINISH_RETRY_TIMES, PROTOCOL_CMD_INVALID_AMALGAMATE_STAGE, PROTOCOL_CMD_INVALID_CANDIDATE_AGREEMENT_STAGE, PROTOCOL_CMD_INVALID_BLOCK_AGREEMENT_STAGE, RIPPLE_STATE_IDLE, RIPPLE_STATE_STAGE_CONSENSUS, RIPPLE_STATE_TRANSACTIONS_CONSENSUS, MAX_PROCESS_TRANSACTIONS_SIZE, RIPPLE_STAGE_AMALGAMATE, RIPPLE_STAGE_CANDIDATE_AGREEMENT, RIPPLE_STAGE_BLOCK_AGREEMENT } = require("../constant");
const assert = require("assert");
const Counter = require("./counter");
const Perish = require("./perish");
const utils = require("../../depends/utils");
const AsyncEventemitter = require("async-eventemitter");

const bufferToInt = utils.bufferToInt;
const rlp = utils.rlp;

const p2p = process[Symbol.for("p2p")];
const logger = process[Symbol.for("loggerConsensus")];

class Ripple extends AsyncEventemitter
{
	constructor(processor)
	{
		super();

		this.processor = processor;

		this.maxTimeoutTimes = 0;
		this.ownTimeoutNodesUserdForStatistic = new Set();
		this.friendNodesTimeoutNodesUserdForStatistic = new Set();

		this.maxCheatedTimes = 0;
		this.cheatedNodesForStatistic = new Set();

		this.state = RIPPLE_STATE_IDLE;

		this.round = 0;
		this.stage = 0;

		// this should store in database
		this.pursueTime = 0;

		this.counter = new Counter(this);
		this.perish = new Perish(this);
		this.amalgamate = new Amalgamate(this);
		this.candidateAgreement = new CandidateAgreement(this);
		this.blockAgreement = new BlockAgreement(this);

		this.processingTransactions = [];

		this.amalgamateMessagesCache = [];
		const self = this;
		this.on("blockProcessOver", () => {
			for(let i = 0; i < self.amalgamateMessagesCache.length; i++)
			{
				let {address, cmd, data} = self.amalgamateMessagesCache[i];
				self.amalgamate.handleMessage(address, cmd, data);
			}

			self.amalgamateMessagesCache = [];
		});
	}

	/*
	 * @param {Boolean} ifRetry
	 */
	run(ifRetry = false)
	{
		if(!ifRetry)
		{
			this.processingTransactions = this.processor.getTransactions(MAX_PROCESS_TRANSACTIONS_SIZE);
		}
		
		this.round += 1;
		this.stage = 0;

		this.amalgamate.run(this.processingTransactions);
		this.state = RIPPLE_STATE_TRANSACTIONS_CONSENSUS;
	}

	/**
	 * @param {Array} cheatedNodes
	 */
	async handleCheatedNodes(cheatedNodes)
	{
		assert(Array.isArray(cheatedNodes), `Ripple handleCheatedNodes, cheatedNodes should be an Array, now is ${typeof cheatedNodes}`);

		cheatedNodes.forEach(cheatedNode => {
			if(self.cheatedNodesForStatistic.has(cheatedNode))
			{
				const count = self.cheatedNodesForStatistic.get(cheatedNode);
				self.cheatedNodesForStatistic.set(cheatedNode, count + 1);
			}
			else
			{
				self.cheatedNodesForStatistic.set(cheatedNode, 1);
			}
		});

		this.maxCheatedTimes += 1;

		// find the cheated nodes

	}

	/**
	 * @param {Array} ownTimeoutNodes
	 * @param {Array} friendNodesTimeoutNodes
	 */
	async handleTimeoutNodes(ownTimeoutNodes, friendNodesTimeoutNodes)
	{
		assert(Array.isArray(ownTimeoutNodes), `Ripple handleTimeoutNodes, ownTimeoutNodes should be an Array, now is ${typeof ownTimeoutNodes}`);
		assert(Array.isArray(friendNodesTimeoutNodes), `Ripple friendNodesTimeoutNodes, friendNodesTimeoutNodes should be an Array, now is ${typeof friendNodesTimeoutNodes}`);
		
		const self = this;
		ownTimeoutNodes.forEach(ownTimeoutNode => {
			if(self.ownTimeoutNodesUserdForStatistic.has(ownTimeoutNode))
			{
				const count = self.ownTimeoutNodesUserdForStatistic.get(ownTimeoutNode);
				self.ownTimeoutNodesUserdForStatistic.set(ownTimeoutNode, count + 1);
			}
			else
			{
				self.ownTimeoutNodesUserdForStatistic.set(ownTimeoutNode, 1);
			}
		});

		friendNodesTimeoutNodes.forEach(friendNodesTimeoutNode => {
			if(self.friendNodesTimeoutNodesUserdForStatistic.has(friendNodesTimeoutNode))
			{
				const count = self.friendNodesTimeoutNodesUserdForStatistic.get(friendNodesTimeoutNode);
				self.friendNodesTimeoutNodesUserdForStatistic.set(friendNodesTimeoutNode, count + 1);
			}
			else
			{
				self.friendNodesTimeoutNodesUserdForStatistic.set(friendNodesTimeoutNode, 1);
			}
		});

		this.maxTimeoutTimes += (STAGE_MAX_FINISH_RETRY_TIMES + 1);

		// find the timeout nodes

	}

	/**
	 * @param {Buffer} round
	 * @param {Buffer} stage
	 * @param {Buffer} primaryConsensusTime
	 * @param {Buffer} finishConsensusTime
	 * @param {Buffer} pastTime
	 */
	handleCounter(round, stage, primaryConsensusTime, finishConsensusTime, pastTime)
	{
		assert(Buffer.isBuffer(round), `Ripple handleCounter, round should be an Buffer, now is ${typeof round}`);
		assert(Buffer.isBuffer(stage), `Ripple handleCounter, stage should be an Buffer, now is ${typeof stage}`);
		assert(Buffer.isBuffer(primaryConsensusTime), `Ripple handleCounter, primaryConsensusTime should be an Buffer, now is ${typeof primaryConsensusTime}`);
		assert(Buffer.isBuffer(finishConsensusTime), `Ripple handleCounter, finishConsensusTime should be an Buffer, now is ${typeof finishConsensusTime}`);
		assert(Buffer.isBuffer(pastTime), `Ripple handleCounter, pastTime should be an Buffer, now is ${typeof pastTime}`);

		round = bufferToInt(round);
		stage = bufferToInt(stage);
		primaryConsensusTime = bufferToInt(primaryConsensusTime);
		finishConsensusTime = bufferToInt(finishConsensusTime);
		pastTime = bufferToInt(pastTime);

		logger.warn(`**************************************\nRipple, begin to handle consensus, unl's round: ${round}, stage: ${stage}, primaryConsensusTime: ${primaryConsensusTime}, finishConsensusTime: ${finishConsensusTime}, pastTime: ${pastTime}**************************************`);
		logger.warn(`**************************************\nRipple, begin to handle consensus, my round: ${this.round}, stage: ${this.stage}\n**************************************\n\n\n\n\n`);

		if(this.round >= round && this.stage >= stage)
		{
			logger.info("************************************ I'm fast ************************************");

			return;
		}

		this.reset();

		this.state = RIPPLE_STATE_STAGE_CONSENSUS;

		this.round = round;

		// compute new round and stage
		const self = this;
		const delayTime = (primaryConsensusTime +  finishConsensusTime - pastTime > 0 ? primaryConsensusTime +  finishConsensusTime - pastTime : 0) + this.pursueTime;
		if(stage === RIPPLE_STAGE_AMALGAMATE)
		{
			setTimeout(() => {
				self.candidateAgreement.run([]);
				self.state = RIPPLE_STATE_TRANSACTIONS_CONSENSUS;
			}, delayTime);
		}
		else if(stage === RIPPLE_STAGE_CANDIDATE_AGREEMENT)
		{
			setTimeout(() => {
				self.blockAgreement.run(rlp.encode([]));
				self.state = RIPPLE_STATE_TRANSACTIONS_CONSENSUS;
			}, delayTime);
		}
		else
		{
			setTimeout(() => {
				self.run();
			}, delayTime);
		}
	}

	/**
	 * @param {Buffer} address
	 * @param {Number} cmd
	 * @param {Buffer} data
	 */
	handleMessage(address, cmd, data)
	{	
		assert(Buffer.isBuffer(address), `Ripple handleMessage, address should be an Buffer, now is ${typeof address}`);
		assert(typeof cmd === "number", `Ripple handleMessage, cmd should be a Number, now is ${typeof cmd}`);
		assert(Buffer.isBuffer(data), `Ripple handleMessage, data should be an Buffer, now is ${typeof data}`);

		if(this.state !== RIPPLE_STATE_TRANSACTIONS_CONSENSUS)
		{
			logger.warn(`***********************************************\nRipple handleMessage, ripple state should be RIPPLE_STATE_TRANSACTIONS_CONSENSUS, now is ${this.state === RIPPLE_STATE_IDLE ? "RIPPLE_STATE_IDLE" : "RIPPLE_STATE_STAGE_CONSENSUS"}\n***********************************************\n\n\n`);
			return;
		}

		if(cmd >= 100 && cmd < 200)
		{
			if(this.blockAgreement.checkFinishState())
			{
				this.blockAgreement.handler();
				this.blockAgreement.reset();
			}

			if(this.blockAgreement.checkProcessBlockState())
			{
				this.amalgamateMessagesCache.push({
					address: address,
					cmd: cmd,
					data: data
				});
			}
			else if(this.amalgamate.checkProcessingState() || this.amalgamate.checkFinishState())
			{
				this.amalgamate.handleMessage(address, cmd, data);
			}
			else
			{
				logger.error(`Ripple handleMessage, address ${address.toString("hex")} is not consensus, block agreement stage is not over`);

				p2p.send(address, PROTOCOL_CMD_INVALID_AMALGAMATE_STAGE);
			}
		}
		else if(cmd >= 200 && cmd < 300)
		{
			if(this.amalgamate.checkFinishState())
			{
				this.amalgamate.handler();
				this.amalgamate.reset();
			}

			if(this.candidateAgreement.checkProcessingState() || this.candidateAgreement.checkFinishState())
			{
				this.candidateAgreement.handleMessage(address, cmd, data);
			}
			else
			{
				logger.error(`Ripple handleMessage, address ${address.toString("hex")} is not consensus, amalgamate stage is not over`);

				p2p.send(address, PROTOCOL_CMD_INVALID_CANDIDATE_AGREEMENT_STAGE);
			}
		}
		else if(cmd >= 300 && cmd < 400)
		{
			if(this.candidateAgreement.checkFinishState())
			{
				this.candidateAgreement.handler();
				this.candidateAgreement.reset();
			}
			
			if(this.blockAgreement.checkProcessingState() || this.blockAgreement.checkFinishState())
			{
				this.blockAgreement.handleMessage(address, cmd, data);
			}
			else
			{
				logger.error(`Ripple handleMessage, address ${address.toString("hex")} is not consensus, candidate agreement stage is not over`);

				p2p.send(address, PROTOCOL_CMD_INVALID_BLOCK_AGREEMENT_STAGE);
			}
		}
		else if(cmd >= 400 && cmd < 500)
		{
			this.counter.handleMessage(address, cmd, data);
		}
		else
		{
			throw new Error(`invalid cmd: ${cmd}`);
		}
	}

	reset()
	{
		this.state = RIPPLE_STATE_IDLE;

		this.amalgamate.reset();
		this.candidateAgreement.reset();
		this.blockAgreement.reset();
	}
}



module.exports = Ripple;