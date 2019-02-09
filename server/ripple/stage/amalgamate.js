const Candidate = require("../data/candidate")
const util = require("../../../utils")
const {postAmalgamateCandidate, postBatchAmalgamateCandidate} = require("../chat")
const async = require("async")
const {SUCCESS, PARAM_ERR, OTH_ERR, STAGE_INVALID} = require("../../../const")
const {RIPPLE_STATE_AMALGAMATE, RIPPLE_STATE_CANDIDATE_AGREEMENT, TRANSACTION_NUM_EACH_ROUND, SEND_DATA_DEFER} = require("../../constant")
const Stage = require("./stage")

const log4js= require("../../logConfig");
const logger = log4js.getLogger();
const errLogger = log4js.getLogger("err");
const othLogger = log4js.getLogger("oth");

class Amalgamate extends Stage
{
	constructor(ripple)
	{
		super(ripple);
		
		const self = this;

		this.ripple.express.post("/amalgamateCandidate", function(req, res) {
			if(!req.body.candidate) {
				res.send({
					code: PARAM_ERR,
					msg: "param error, need candidate"
				});
				return;
			}

	    	// check stage
			if(self.ripple.state !== RIPPLE_STATE_AMALGAMATE)
			{
				res.send({
					code: STAGE_INVALID,
					msg: `state ${RIPPLE_STATE_AMALGAMATE} invalid, current stage is ${self.ripple.state}`
				});
				return;
			}

			res.send({
				code: SUCCESS,
				msg: ""
			});

			self.receive(req.body.candidate);
		});

		this.ripple.on("amalgamateCandidateInnerErr", data => {
			setTimeout(() => {
				postAmalgamateCandidate(self.ripple, data.node.url, self.ripple.candidate);
			}, SEND_DATA_DEFER);
		});

		this.ripple.on("amalgamateCandidateErr", data => {
			setTimeout(() => {
				postAmalgamateCandidate(self.ripple, data.node.url, self.ripple.candidate);
			}, SEND_DATA_DEFER);
		});

		this.ripple.on("amalgamateCandidateSuccess", data => {
			self.recordAccessedNode(data.node.address);

			// check if mandatory time window is end
			if(self.ripple.timeout)
			{
				return;
			}

			self.tryToEnterNextStage();
		});
	}

	run()
	{
		const self = this;

		this.send();

		this.ripple.initTimeout(() => {
			self.ripple.timeout = null;

			self.tryToEnterNextStage();
		});
	}

	send()
	{
		// check if begin a new candidate
		if(this.ripple.candidate.length === 0)
		{
			// get cached transactions
			let transactions = this.ripple.processor.transactionsPool.splice(0, TRANSACTION_NUM_EACH_ROUND);
			// encode tranasctions
			this.ripple.candidate.batchPush(transactions);
		}
		
		this.ripple.candidate.poolDataToCandidateTransactions();
		//
		postBatchAmalgamateCandidate(this.ripple);
	}

	receive(candidate)
	{
		candidate = new Candidate(candidate);

		// check candidate
		let errors1 = candidate.validateSignatrue(true);
		if(!!errors1 === true)
		{
			logger.error(`class Amalgamate, candidate validateSignatrue is failed, ${errors1}`);
		}
		else
		{
			this.ripple.recordActiveNode(util.baToHexString(candidate.from));
		}
		
		let errors2 = candidate.validateTransactions(true)
		if(!!errors2 === true)
		{
			logger.error(`class Amalgamate, candidate transactions is failed, ${errors2}`);
		}
		
		if(!!errors1 === false && !!errors2 === false)
		{
			// merge transactions, filter same transaction
			candidate.candidateTransactionsToPoolData();
			this.ripple.candidate.batchPush(candidate.data, true);
		}

		// check if mandatory time window is end
		if(this.ripple.timeout)
		{
			return;
		}

		this.tryToEnterNextStage();
	}

	tryToEnterNextStage()
	{
		// check and transfer to next stage
		if(self.checkIfCanEnterNextStage())
		{
			logger.warn("class Amalgamate, amalgamate is over, go to next stage");

			// transfer to transaction agreement stage
			self.ripple.emit("amalgamateOver");
		}
	}
}

module.exports = Amalgamate;