const Candidate = require("../data/candidate")
const util = require("../../../utils")
const {postConsensusCandidate, postBatchConsensusCandidate} = require("../chat")
const {RIPPLE_STATE_EMPTY, ROUND_NUM, SEND_DATA_DEFER, RIPPLE_STATE_CANDIDATE_AGREEMENT_ROUND1, RIPPLE_STATE_CANDIDATE_AGREEMENT_ROUND2, RIPPLE_STATE_CANDIDATE_AGREEMENT_ROUND3} = require("../../constant")
const {SUCCESS, PARAM_ERR, OTH_ERR, STAGE_INVALID} = require("../../../const")
const Stage = require("./stage")

const log4js= require("../../logConfig");
const logger = log4js.getLogger();
const errLogger = log4js.getLogger("err");
const othLogger = log4js.getLogger("oth");

const ROUND1_THRESHHOLD = 0.5
const ROUND2_THRESHHOLD = 0.6
const ROUND3_THRESHHOLD = 0.8

class CandidateAgreement extends Stage
{
	constructor(ripple)
	{
		super(ripple);
		
		const self = this;

		this.round = 1;

		this.ripple.express.post("/consensusCandidate", function(req, res) {
			if(!req.body.candidate) {
		        res.send({
		            code: PARAM_ERR,
		            msg: "param error, need candidate"
		        });
		        return;
		    }

		    if(!req.body.state) {
		        res.send({
		            code: PARAM_ERR,
		            msg: "param error, need state"
		        });
		        return;
		    }

			// check stage
			if(self.ripple.state !== RIPPLE_STATE_CANDIDATE_AGREEMENT_ROUND1 &&
				self.ripple.state !== RIPPLE_STATE_CANDIDATE_AGREEMENT_ROUND2 &&
				self.ripple.state !== RIPPLE_STATE_CANDIDATE_AGREEMENT_ROUND3)
			{
				res.send({
					code: STAGE_INVALID,
					msg: `stage invalid, current stage is ${self.ripple.state}`
				});

				return;
			}

		    // check stage
		    if(self.ripple.state !== req.body.state)
			{
				res.send({
					code: STAGE_INVALID,
					msg: `stage ${req.body.state} invalid, current stage is ${self.ripple.state}`
				});

				return;
			}

			res.send({
				code: SUCCESS,
				msg: ""
	      	});

		    self.receive(req.body.candidate);
		});

		this.ripple.on("amalgamateOver", () => {
			this.round = 1;

			this.ripple.emit("candidateAgreementRound");
	  	});

		this.ripple.on("candidateAgreementRound", () => {
			logger.warn(`class CandidateAgreement, candidate consensus begin, round ${self.round}`);

			// clear state
			self.reset();

			// clear invalid transactions
			if(self.round === 2 || self.round === 3 || self.round === 4)
			{
				logger.warn(`class CandidateAgreement, clear invalid transactions, round ${self.round - 1}`);
				self.ripple.candidate.clearInvalidTransaction(self.threshhold);
			}

			// check if stage is over
			if(self.round > ROUND_NUM)
			{
				logger.warn("class CandidateAgreement, candidate consensus is over, go to next stage");

				self.ripple.state = RIPPLE_STATE_EMPTY;

				// transfer to block agreement stage
				self.ripple.emit("candidateAgreementOver");
				return;
			}

			// compute state
			if(self.round === 1)
			{
				self.ripple.state = RIPPLE_STATE_CANDIDATE_AGREEMENT_ROUND1;

				self.threshhold = ROUND1_THRESHHOLD;
			}

			if(self.round === 2)
			{
				self.ripple.state = RIPPLE_STATE_CANDIDATE_AGREEMENT_ROUND2;

				self.threshhold = ROUND2_THRESHHOLD;
			}

			if(self.round === 3)
			{
				self.ripple.state = RIPPLE_STATE_CANDIDATE_AGREEMENT_ROUND3;

				self.threshhold = ROUND3_THRESHHOLD;
			}

			// begin consensus
			self.run();
		});

	  	this.ripple.on("consensusCandidateInnerErr", data => {
	  		// check stage
			if(self.ripple.state !== RIPPLE_STATE_CANDIDATE_AGREEMENT_ROUND1 &&
				self.ripple.state !== RIPPLE_STATE_CANDIDATE_AGREEMENT_ROUND2 &&
				self.ripple.state !== RIPPLE_STATE_CANDIDATE_AGREEMENT_ROUND3)
			{
				return;
			}

			setTimeout(() => {
				postConsensusCandidate(self.ripple, data.node, self.ripple.candidate);
			}, SEND_DATA_DEFER);
			
		});

	  	this.ripple.on("consensusCandidateErr", data => {
	  		// check stage
			if(self.ripple.state !== RIPPLE_STATE_CANDIDATE_AGREEMENT_ROUND1 &&
				self.ripple.state !== RIPPLE_STATE_CANDIDATE_AGREEMENT_ROUND2 &&
				self.ripple.state !== RIPPLE_STATE_CANDIDATE_AGREEMENT_ROUND3)
			{
				return;
			}
			
			setTimeout(() => {
				postConsensusCandidate(self.ripple, data.node, self.ripple.candidate);
			}, SEND_DATA_DEFER);
		});

		this.ripple.on("consensusCandidateSuccess", data => {
			self.recordAccessedNode(data.node.address);

			self.tryToEnterNextStage();
		});
	}

	/**
	 * transactions consensus, note!!! this is a private func, please no not call it
	 */
	run()
	{
		const self = this;

		this.send();

		this.initTimeout();
	}

	send()
	{	
		// encode tranasctions
		this.ripple.candidate.poolDataToCandidateTransactions();
		//
		logger.warn("*********************candidate send transactions*********************")
		for(let i = 0; i < this.ripple.candidate.length; i++)
		{
			let hash = util.baToHexString(this.ripple.candidate.get(i).hash(true));
			logger.warn(`transaction index: ${i}, hash: ${hash}`);
		}
		//
		postBatchConsensusCandidate(this.ripple);
	}

	receive(candidate)
	{
		candidate = new Candidate(candidate);

		// check candidate
		let errors = candidate.validateSignatrue(true);
		if(!!errors === true)
		{
			logger.error(`class CandidateAgreement, candidate receive is failed, ${errors}`);
		}
		else
		{
			this.recordActiveNode(util.baToHexString(candidate.from));

			// record transactions
			candidate.candidateTransactionsToPoolData();

			//
			logger.warn("*********************candidate receive transactions*********************")
			for(let i = 0; i < candidate.length; i++)
			{
				let hash = util.baToHexString(candidate.get(i).hash(true));
				logger.warn(`transaction index: ${i}, hash: ${hash}`);
			}

			//
			this.ripple.candidate.batchPush(candidate.data);
		}

		this.tryToEnterNextStage();
	}

	tryToEnterNextStage()
	{	
		// check and transfer to next round
		if(this.checkIfTimeoutEnd() || this.checkIfCanEnterNextStage())
		{
			logger.warn("Class CandidateAgreement, candidate consensus is over, go to next round");
			
			// clear timeout
			this.clearTimeout();

			this.ripple.state = RIPPLE_STATE_EMPTY;

			this.round++;

			this.ripple.emit("candidateAgreementRound");
		}
	}
}
module.exports = CandidateAgreement;