const Amalgamate = require("./consensusStage/amalgamate");
const PrePrepare = require("./consensusStage/prePrepare");
const Prepare = require("./consensusStage/prepare");
const Ready = require("./consensusStage/ready");
const Commit = require("./consensusStage/commit");
const FetchConsensusCandidate = require("./consensusStage/fetchConsensusCandidate");
const ViewChangeForConsensusFail = require("./abnormalStage/viewChangeForConsensusFail");
const ViewChangeForTimeout = require("./abnormalStage/viewChangeForTimeout");
const FetchProcessState = require("./abnormalStage/fetchProcessState");
const NewView = require("./abnormalStage/newView");
const utils = require("../../depends/utils");
const { randomBytes } = require("crypto");
const { CHEAT_REASON_INVALID_PROTOCOL_CMD, 
	RIPPLE_STATE_EMPTY,
	MAX_PROCESS_TRANSACTIONS_SIZE,
	RIPPLE_LEADER_EXPIRATION,
	RIPPLE_NEW_VIEW_FOR_INVALID_SEQUENCE_EXPIRATION,

	STAGE_AMALGAMATE, 
	STAGE_PRE_PREPARE, 
	STAGE_PREPARE, 
	STAGE_READY,
	STAGE_COMMIT, 
	STAGE_FETCH_CANDIDATE, 
	STAGE_PROCESS_CONSENSUS_CANDIDATE,
	STAGE_VIEW_CHANGE_FOR_CONSENSUS_FAIL,

	RIPPLE_STATE_CONSENSUS,
	RIPPLE_STATE_NEW_VIEW,
	RIPPLE_STATE_FETCH_PROCESS_STATE,
	RIPPLE_STATE_FETCH_BLOCK_CHAIN,

	PROTOCOL_CMD_TRANSACTION_AMALGAMATE_REQ,
	PROTOCOL_CMD_TRANSACTION_AMALGAMATE_RES,
	PROTOCOL_CMD_PRE_PREPARE_REQ,
	PROTOCOL_CMD_PRE_PREPARE_RES,
	PROTOCOL_CMD_PREPARE,
	PROTOCOL_CMD_READY,
	PROTOCOL_CMD_COMMIT,
	PROTOCOL_CMD_CONSENSUS_CANDIDATE_REQ,
	PROTOCOL_CMD_CONSENSUS_CANDIDATE_RES,
	PROTOCOL_CMD_VIEW_CHANGE_FOR_CONSENSUS_FAIL,
	PROTOCOL_CMD_VIEW_CHANGE_FOR_TIMEOUT,
	PROTOCOL_CMD_NEW_VIEW_REQ,
	PROTOCOL_CMD_NEW_VIEW_RES,
	PROTOCOL_CMD_PROCESS_STATE_REQ,
	PROTOCOL_CMD_PROCESS_STATE_RES } = require("./constants");
const { PROCESS_BLOCK_SUCCESS, PROCESS_BLOCK_PARENT_BLOCK_NOT_EXIST, PROCESS_BLOCK_NO_TRANSACTIONS } = require("../constants");

const assert = require("assert");
const Block = require("../../depends/block");
const Update = require("./update");

const BN = utils.BN;
const rlp = utils.rlp;

const logger = process[Symbol.for("loggerConsensus")];
const mysql = process[Symbol.for("mysql")];
const unlManager = process[Symbol.for("unlManager")];

const WATER_LINE_STEP_LENGTH = 1111 + 926;
const SYSTEM_LOOP_DELAY_TIME = 20;

const SEQUENCE_MODE_MATCH = 1;
const SEQUENCE_MODE_LARGER = 2;
const SEQUENCE_MODE_MATCH_OR_LARGER = 3;

const FLUSH_CHEATED_NODES_INTERVAL = 60 * 1000;

class Ripple
{
	constructor(processor)
	{
		this.processor = processor;

		this.state = RIPPLE_STATE_EMPTY;
		
		// 
		this.localTransactions = [];
		this.amalgamatedTransactions = new Set();
		this.candidate = undefined;
		this.candidateDigest = undefined;
		this.consensusCandidateDigest = undefined;
		this.decidedCandidateDigest = undefined;

		//
		this.amalgamate = new Amalgamate(this);
		this.prePrepare = new PrePrepare(this);
		this.prepare = new Prepare(this);
		this.ready = new Ready(this);
		this.commit = new Commit(this);
		this.fetchConsensusCandidate = new FetchConsensusCandidate(this);
		this.viewChangeForConsensusFail = new ViewChangeForConsensusFail(this);
		this.fetchProcessState = new FetchProcessState(this);
		this.viewChangeForTimeout = new ViewChangeForTimeout(this);
		this.newView = new NewView(this);

		//
		this.msgBuffer = new Map();

		//
		this.sequence = Buffer.alloc(0);
		this.hash = undefined;
		this.number = undefined;
		this.view = Buffer.alloc(0);

		//
		this.update = new Update();

		//
		this.newViewForInvalidSequenceTimes = 0;

		//
		this.cheatedNodes = [];
	}

	close()
	{
		this.state = RIPPLE_STATE_EMPTY;
	}

	get eachRoundMaxFetchTransactionsSize()
	{
		return parseInt(MAX_PROCESS_TRANSACTIONS_SIZE / unlManager.unlFullSize);
	}

	get highWaterLine()
	{
		return this.lowWaterLine.addn(WATER_LINE_STEP_LENGTH);
	}

	get lowWaterLine()
	{
		return new BN(this.view).muln(WATER_LINE_STEP_LENGTH);
	}

	/**
	 * @param {Buffer} address
	 * @param {Number} cmd
	 * @param {Buffer} data
	 */
	handleMessage({ address, cmd, data }) {
		assert(Buffer.isBuffer(address), `Ripple handleMessage, address should be an Buffer, now is ${typeof address}`);
		assert(typeof cmd === 'number', `Ripple handleMessage, cmd should be a Number, now is ${typeof cmd}`);
		assert(Buffer.isBuffer(data), `Ripple handleMessage, data should be an Buffer, now is ${typeof data}`);

		switch (cmd) {
			case PROTOCOL_CMD_TRANSACTION_AMALGAMATE_REQ:
			case PROTOCOL_CMD_TRANSACTION_AMALGAMATE_RES:
			case PROTOCOL_CMD_PRE_PREPARE_REQ:
			case PROTOCOL_CMD_PRE_PREPARE_RES:
			case PROTOCOL_CMD_PREPARE:
			case PROTOCOL_CMD_COMMIT:
			case PROTOCOL_CMD_CONSENSUS_CANDIDATE_REQ:
			case PROTOCOL_CMD_CONSENSUS_CANDIDATE_RES:
			case PROTOCOL_CMD_VIEW_CHANGE_FOR_CONSENSUS_FAIL:
			case PROTOCOL_CMD_VIEW_CHANGE_FOR_TIMEOUT:
			case PROTOCOL_CMD_NEW_VIEW_REQ:
			case PROTOCOL_CMD_NEW_VIEW_RES:
			case PROTOCOL_CMD_PROCESS_STATE_RES:
				{
					//
					let msgsDifferByCmd = this.msgBuffer.get(cmd);
					const [sequence] = rlp.decode(data);

					//
					if (!msgsDifferByCmd)
					{
						msgsDifferByCmd = [];
					}	
					
					// 
					logger.info(`Ripple handleMessage, receive msg, cmd: ${cmd}, sequence: ${sequence.toString('hex')}, address: ${address.toString('hex')}`)

					// update msg buffer
					msgsDifferByCmd.push({ sequence, address, data });
					this.msgBuffer.set(cmd, msgsDifferByCmd);
				}
				break;
			case PROTOCOL_CMD_PROCESS_STATE_REQ:
				{
					if(this.hash !== undefined || this.number !== undefined)
					{
						this.fetchProcessState.handleMessage(address, cmd, data);
					}
				}
				break;
			default:
				{
					this.cheatedNodes.push({
						address: address.toString('hex'),
						reason: CHEAT_REASON_INVALID_PROTOCOL_CMD
					});
				}
		}
	}

	async run()
	{
		//
		this.flushCheatedNodesTimer = setTimeout(() => {
			for (let { address, reason } of this.cheatedNodes) {
				mysql.saveCheatedNode(address, reason).catch(e => {
					logger.fatal(`Ripple flush cheated nodes, saveCheatedNode throw exception, ${process[Symbol.for("getStackInfo")](e)}`);

					process[Symbol.for("gentlyExitProcess")]();
				});
			}
		}, FLUSH_CHEATED_NODES_INTERVAL);

		// fetch new txs
		({ transactions: this.localTransactions, deleteTransactions: this.deleteTransactions } = await mysql.getRawTransactions(this.eachRoundMaxFetchTransactionsSize));

		// init block chain
		await this.update.init();

		// sync nodes info
		await this.waitNodesInfoFinished();

		// sync block chain and process state
		await this.syncProcessState();
		
		//
		while(1)
		{
			if(this.state === RIPPLE_STATE_EMPTY)
			{
				return;
			}


			/*********************** first handle process state sync msgs **********************/
			if(this.state === RIPPLE_STATE_FETCH_BLOCK_CHAIN)
			{
				await new Promise(resolve => {
					setTimeout(() => {
						resolve();
					}, SYSTEM_LOOP_DELAY_TIME);
				});

				continue;
			}

			if(this.state === RIPPLE_STATE_FETCH_PROCESS_STATE)
			{
				const msg = this.fetchMsgWithSequence({
					cmd: PROTOCOL_CMD_PROCESS_STATE_RES,
					sequenceMode: SEQUENCE_MODE_MATCH_OR_LARGER
				});
				if (msg) {
					this.fetchProcessState.handleMessage(msg.address, msg.cmd, msg.data);

					continue;
				}

				//
				await new Promise(resolve => {
					setTimeout(() => {
						resolve();
					}, SYSTEM_LOOP_DELAY_TIME);
				});

				continue;
			}

			/*********************** hanlde new view msgs, this may be lead to view change action **********************/
			let msgNewViewReq = this.fetchMsgWithoutSequence({
				cmd: PROTOCOL_CMD_NEW_VIEW_REQ
			});
			if (msgNewViewReq) {
				this.newView.handleMessage(msgNewViewReq.address, msgNewViewReq.cmd, msgNewViewReq.data);
			}

			/*********************** handle view change for timeout, this may lead to view change action **********************/
			let msgViewChangeForTimeout = this.fetchMsgWithoutSequence({
				cmd: PROTOCOL_CMD_VIEW_CHANGE_FOR_TIMEOUT
			});
			if(msgViewChangeForTimeout)
			{
				this.viewChangeForTimeout.handleMessage(msgViewChangeForTimeout.address, msgViewChangeForTimeout.cmd, msgViewChangeForTimeout.data);
			}
			if(this.state === RIPPLE_STATE_NEW_VIEW)
			{	
				const msg = this.fetchMsgWithoutSequence({
					cmd: PROTOCOL_CMD_NEW_VIEW_RES
				});
				if (msg) {
					this.newView.handleMessage(msg.address, msg.cmd, msg.data);

					continue;
				}
			}
			
			if (this.state === RIPPLE_STATE_CONSENSUS) {

				//
				const msg = this.fetchMsgWithSequence({
					cmd: PROTOCOL_CMD_CONSENSUS_CANDIDATE_REQ,
					sequenceMode: SEQUENCE_MODE_MATCH
				});
				if (msg) {
					this.fetchConsensusCandidate.handleMessage(msg.address, msg.cmd, msg.data);
				}

				//
				switch (this.stage) {
					case STAGE_AMALGAMATE:
						{
							const msg1 = this.fetchMsgWithSequence({
								cmd: PROTOCOL_CMD_TRANSACTION_AMALGAMATE_REQ, 
								sequenceMode: SEQUENCE_MODE_LARGER
							});
							if(msg1)
							{
								this.amalgamate.handleMessage(msg1.address, msg1.cmd, msg1.data);

								continue;
							}

							const msg2 = this.fetchMsgWithSequence({
								cmd: PROTOCOL_CMD_TRANSACTION_AMALGAMATE_RES, 
								sequenceMode: SEQUENCE_MODE_MATCH
							});
							if (msg2) {
								this.amalgamate.handleMessage(msg2.address, msg2.cmd, msg2.data);

								continue;
							}
						}
						break;
					case STAGE_PRE_PREPARE:
						{
							const msg1 = this.fetchMsgWithSequence({
								cmd: PROTOCOL_CMD_PRE_PREPARE_REQ, 
								sequenceMode: SEQUENCE_MODE_MATCH
							});
							if (msg1) {
								this.prePrepare.handleMessage(msg1.address, msg1.cmd, msg1.data);

								continue;
							}

							const msg2 = this.fetchMsgWithSequence({
								cmd: PROTOCOL_CMD_PRE_PREPARE_RES, 
								sequenceMode: SEQUENCE_MODE_MATCH
							});
							if (msg2) {
								this.prePrepare.handleMessage(msg2.address, msg2.cmd, msg2.data);

								continue;
							}
						}
						break;
					case STAGE_PREPARE:
						{
							const msg = this.fetchMsgWithSequence({
								cmd: PROTOCOL_CMD_PREPARE, 
								sequenceMode: SEQUENCE_MODE_MATCH
							});
							if (msg) {
								this.prepare.handleMessage(msg.address, msg.cmd, msg.data);

								continue;
							}
						}
						break;
					case STAGE_READY:
						{
							const msg = this.fetchMsgWithSequence({
								cmd: PROTOCOL_CMD_READY,
								sequenceMode: SEQUENCE_MODE_MATCH
							});
							if (msg) {
								this.ready.handleMessage(msg.address, msg.cmd, msg.data);

								continue;
							}
						}
						break;
					case STAGE_COMMIT:
						{
							const msg = this.fetchMsgWithSequence({
								cmd: PROTOCOL_CMD_COMMIT, 
								sequenceMode: SEQUENCE_MODE_MATCH
							});
							if (msg) {
								this.commit.handleMessage(msg.address, msg.cmd, msg.data);

								continue;
							}
						}
						break;
					case STAGE_FETCH_CANDIDATE:
						{
							const msg = this.fetchMsgWithSequence({
								cmd: PROTOCOL_CMD_CONSENSUS_CANDIDATE_RES, 
								sequenceMode: SEQUENCE_MODE_MATCH
							});
							if (msg) {
								this.fetchConsensusCandidate.handleMessage(msg.address, msg.cmd, msg.data);
							
								continue;
							}
						}
						break;
					case STAGE_PROCESS_CONSENSUS_CANDIDATE:
						{
							
						}
						break;
					case STAGE_VIEW_CHANGE_FOR_CONSENSUS_FAIL:
						{
							const msg = this.fetchMsgWithSequence({
								cmd: PROTOCOL_CMD_VIEW_CHANGE_FOR_CONSENSUS_FAIL,
								sequenceMode: SEQUENCE_MODE_MATCH
							});

							if (msg) {
								this.viewChangeForConsensusFail.handleMessage(msg.address, msg.cmd, msg.data);
								
								continue;
							}
						}
						break;
					default: 
						{
							logger.fatal(`Ripple run, invalid RIPPLE_STATE_CONSENSUS stage ${this.stage}`);

							process[Symbol.for("gentlyExitProcess")]();
						}
				}
			}
			
			await new Promise(resolve => {
				setTimeout(() => {
					resolve();
				}, SYSTEM_LOOP_DELAY_TIME);
			});
		}
	}

	/**
	 * 
	 */
	runNewConsensusRound()
	{
		//
		this.amalgamatedTransactions.clear();
		this.candidate = undefined;
		this.candidateDigest = undefined;
		this.consensusCandidateDigest = undefined;
		this.decidedCandidateDigest = undefined;

		//
		this.amalgamate.reset();
		this.prePrepare.reset();
		this.prepare.reset();
		this.ready.reset();
		this.commit.reset();
		this.fetchConsensusCandidate.reset();
		this.viewChangeForConsensusFail.reset();

		//
		this.clearLeaderTimer();

		//
		this.clearNewViewTimerForInvalidSequence();

		//
		this.state = RIPPLE_STATE_CONSENSUS;

		// flush unl info
		unlManager.flushUnlToMemory().then(() => {
			this.amalgamate.run();
		}).catch(e => {
			logger.fatal(`Ripple runNewConsensusRound, throw exception, ${process[Symbol.for("getStackInfo")](e)}`);

			process[Symbol.for("gentlyExitProcess")]()
		});
	}

	async waitNodesInfoFinished()
	{
		do {
			//
			if (unlManager.unlFullSize >= process[Symbol.for("nodeIndex")] + 1)
			{
				break;
			}

			//
			logger.warn(`Ripple waitNodesInfoFinished, min nodes size is ${process[Symbol.for("nodeIndex")] + 1}, now is ${unlManager.unlFullSize}`);

			//
			await new Promise(resolve => {
				setTimeout(() => {
					resolve();
				}, 2000);
			});

			// refresh unl
			await unlManager.flushUnlToMemory();

		} while (1);
	}

	async syncProcessState()
	{
		if(this.state === RIPPLE_STATE_NEW_VIEW)
		{
			logger.info("Ripple syncProcessState, current state can not be RIPPLE_STATE_NEW_VIEW");

			return;
		}

		this.state = RIPPLE_STATE_FETCH_BLOCK_CHAIN;

		// update block chain
		await this.update.synchronize();
	
		// init number
		this.number = this.update.lastestBlockNumber;

		// init hash
		this.hash = this.update.lastestBlockHash;

		// update process state
		this.fetchProcessState.run();
		
	}

	/**
	 * 
	 */
	processConsensusCandidate()
	{
		const consensusBlock = new Block({
			header: {
				number: new BN(this.candidate.number).addn(1),
				parentHash: this.candidate.blockHash,
				timestamp: this.candidate.timestamp
			},
			transactions: this.candidate.transactions
		});

		this.stage = STAGE_PROCESS_CONSENSUS_CANDIDATE;

		// check if include localTransaction
		let ifLocalTxHasBeenConsensused;
		
		if (this.localTransactions.length > 0)
		{
			const consensusedTxs = rlp.decode(this.candidate.transactions);

			if (consensusedTxs.length > 0)
			{
				const randomLocalTx = this.localTransactions[new BN(randomBytes(2)).modn(this.localTransactions.length)];

				ifLocalTxHasBeenConsensused = !!consensusedTxs.find(tx => tx.toString('hex') === randomLocalTx.toString('hex'))
			
				if (!ifLocalTxHasBeenConsensused)
				{
					logger.error(`Ripple processConsensusCandidate, random, txHash: ${utils.sha256(randomLocalTx).toString('hex')}, should be in candidate`);
				}
			}
			else
			{
				logger.error(`Ripple processConsensusCandidate, zero, txHash: ${utils.sha256(this.localTransactions[0]).toString('hex')}, should be in candidate`);

				ifLocalTxHasBeenConsensused = false;
			}
		}
		else
		{
			ifLocalTxHasBeenConsensused = true;
		}
		
		//
		(async () => {
			// process block
			const result = await this.processor.processBlock({
				block: consensusBlock
			});
			
			// block chain out of data
			if (result === PROCESS_BLOCK_PARENT_BLOCK_NOT_EXIST) {
				logger.fatal(`Ripple processConsensusCandidate, parent block is not exist, there may be a bifurcate, please cleat storage`);

				process[Symbol.for("gentlyExitProcess")]();
			}

			//
			if (result === PROCESS_BLOCK_SUCCESS)
			{
				// update hash and number
				this.hash = consensusBlock.hash();
				this.number = consensusBlock.header.number;

				//
				if (ifLocalTxHasBeenConsensused)
				{
					//
					await this.deleteTransactions();

					// fetch new txs
					({ transactions: this.localTransactions, deleteTransactions: this.deleteTransactions } = await mysql.getRawTransactions(this.eachRoundMaxFetchTransactionsSize));
				}
				
			}

			if (result === PROCESS_BLOCK_NO_TRANSACTIONS)
			{
				if (ifLocalTxHasBeenConsensused) {
					//
					await this.deleteTransactions();

					// fetch new txs
					({ transactions: this.localTransactions, deleteTransactions: this.deleteTransactions } = await mysql.getRawTransactions(this.eachRoundMaxFetchTransactionsSize));
				}
			}

			// notice view may have been changed
			this.runNewConsensusRound();
		})().catch(e => {
			logger.fatal(`Ripple processConsensusCandidate, throw exception, ${process[Symbol.for("getStackInfo")](e)}`);

			process[Symbol.for("gentlyExitProcess")]();
		});
	}

	startNewViewForInvalidSequenceTimer()
	{
		this.newViewForInvalidSequenceTimer = setTimeout(() => {
			//
			if (this.state === RIPPLE_STATE_NEW_VIEW) {
				logger.info("Ripple startNewViewForInvalidSequenceTimer, current state can not be RIPPLE_STATE_NEW_VIEW");

				return;
			}

			if (this.newViewForInvalidSequenceTimes >= unlManager.unlFullSize)
			{
				logger.info("Ripple startNewViewForInvalidSequenceTimer, try time threshould is reach");

				this.syncProcessState().catch(e => {
					logger.fatal(`Ripple startNewViewForInvalidSequenceTimer, throw exception, ${process[Symbol.for("getStackInfo")](e)}`);

					process[Symbol.for("gentlyExitProcess")]();
				});

				return;
			}

			/**************** new view failed, try to enter next view ****************/
			
			//
			this.newViewForInvalidSequenceTimes += 1;
			
			// try to change to next view
			this.viewChangeForTimeout.run(new BN(this.view).addn(this.newViewForInvalidSequenceTimes).toBuffer());

			// wait new leader is on position
			// if failed, try to sync process state
			this.startNewViewForInvalidSequenceTimer();
		}, RIPPLE_NEW_VIEW_FOR_INVALID_SEQUENCE_EXPIRATION);
	}

	clearNewViewTimerForInvalidSequence()
	{
		if (this.newViewForInvalidSequenceTimer) {
			clearTimeout(this.newViewForInvalidSequenceTimer);
		}

		this.newViewForInvalidSequenceTimer = undefined;
		this.newViewForInvalidSequenceTimes = 0;
	}

	startLeaderTimer()
	{
		this.leaderTimeout = setTimeout(() => {
			// try to view change
			this.viewChangeForTimeout.run();

			// try to sync state
			this.syncProcessState().catch(e => {
				logger.fatal(`Ripple startLeaderTimer, throw exception, ${process[Symbol.for("getStackInfo")](e)}`);

				process[Symbol.for("gentlyExitProcess")]();
			});
		}, RIPPLE_LEADER_EXPIRATION);
	}

	clearLeaderTimer()
	{
		if (this.leaderTimeout)
		{
			clearTimeout(this.leaderTimeout);
		}
		
		this.leaderTimeout = undefined;
	}

	/**
	 * 
	 * @param {String} address 
	 */
	checkLeader(address)
	{
		assert(typeof address === 'string', `Ripple checkLeader, address should be a String, now is ${typeof address}`);

		let leaderIndex = new BN(this.view).modn(unlManager.unlFullSize);
		for (let node of unlManager.unlIncludeSelf) {
			if (node.index === leaderIndex && node.address === address) {
				return true;
			}
		}

		return false;
	}

	/**
	 * @param {Buffer} view
	 * @return {Buffer} address
	 */
	nextViewLeaderAddress(view = this.view)
	{
		assert(Buffer.isBuffer(view), `Ripple nextViewLeaderAddress, view should be a Buffer, now is ${typeof view}`);

		let nextViewLeaderIndex = new BN(view).addn(1).modn(unlManager.unlFullSize);
		for (let node of unlManager.unlIncludeSelf)
		{
			if (node.index === nextViewLeaderIndex)
			{
				return Buffer.from(node.address, 'hex');
			}
		}

		logger.fatal(`Ripple nextViewLeaderAddress, nextViewLeaderIndex: ${nextViewLeaderIndex}, not exist, ${process[Symbol.for("getStackInfo")]()}`);
		
		process[Symbol.for("gentlyExitProcess")]();
	}

	get threshould() 
	{
		return parseInt(unlManager.unlFullSize * 2 / 3 + 1);
	}

	/**
	 * @param {Number} cmd
	 * @return {Object}
	 */
	fetchMsgWithoutSequence({ cmd })
	{
		assert(typeof cmd === 'number', `Ripple fetchMsgWithoutSequence, cmd should be a Number, now is ${typeof cmd}`);

		const msgsDifferByCmd = this.msgBuffer.get(cmd) || [];

		const msg = msgsDifferByCmd.shift();
		if (msg)
		{
			return {
				address: msg.address,
				cmd: cmd,
				data: msg.data
			};
		}
	}

	/**
	 * @param {Number} cmd 
	 * @param {NUmber} sequenceMode
	 * @return {Object} 
	 */
	fetchMsgWithSequence({ cmd, sequenceMode })
	{
		assert(typeof cmd === 'number', `Ripple fetchMsgWithSequence, cmd should be a Number, now is ${typeof cmd}`);
		assert(typeof sequenceMode === 'number', `Ripple fetchMsgWithSequence, sequenceMode should be a Number, now is ${typeof sequenceMode}`);

		const msgsDifferByCmd = this.msgBuffer.get(cmd) || [];

		//
		let correspondMsg = undefined;
		
		// delete expired msgs
		const filteredMsgs = [];
		for (let msg of msgsDifferByCmd)
		{
			// filter msg with invalid seuqnce
			if(new BN(msg.sequence).lt(new BN(this.sequence)))
			{
				continue;
			}

			// correpond msg has found, record follow msg
			if (correspondMsg !== undefined) {
				filteredMsgs.push(msg);

				continue;
			}

			// find correspond msg
			if(sequenceMode === SEQUENCE_MODE_MATCH)
			{
				if (msg.sequence.toString('hex') === this.sequence.toString('hex')) {
					correspondMsg = {
						address: msg.address,
						cmd: cmd,
						data: msg.data
					};
				}
				else {
					filteredMsgs.push(msg);
				}
			}
			else if (sequenceMode === SEQUENCE_MODE_LARGER)
			{
				if (new BN(msg.sequence).gt(new BN(this.sequence))) {
					correspondMsg = {
						address: msg.address,
						cmd: cmd,
						data: msg.data
					};
				}
				else {
					filteredMsgs.push(msg);
				}
			}
			else if (sequenceMode === SEQUENCE_MODE_MATCH_OR_LARGER)
			{
				correspondMsg = {
					address: msg.address,
					cmd: cmd,
					data: msg.data
				};
			}
			else
			{
				logger.fatal(`Ripple fetchMsgWithSequence, invalid sequenceMode ${sequenceMode}`);
				
				process[Symbol.for("gentlyExitProcess")]();
			}
			
		}

		// update msg buffer
		this.msgBuffer.set(cmd, filteredMsgs);
		
		return correspondMsg;
	}

	/**
	 * @param {Array} nodes 
	 */
	async addNodes(nodes) {
		assert(Array.isArray(nodes), `Ripple addNodes, nodes should be an Array, now is ${typeof nodes}`)

		await unlManager.addNodes(nodes);
	}

	/**
	 * @param {Array} nodes 
	 */
	async updateNodes(nodes) {
		assert(Array.isArray(nodes), `Ripple updateNodes, nodes should be an Array, now is ${typeof nodes}`)

		await unlManager.updateNodes(nodes);
	}

	/**
	 * @param {Array} nodes 
	 */
	async deleteNodes(nodes) {
		assert(Array.isArray(nodes), `Ripple deleteNodes, nodes should be an Array, now is ${typeof nodes}`)

		await unlManager.deleteNodes(nodes);
	}
}



module.exports = Ripple;