const { unl } = require("../config.json");
const utils = require("../../depends/utils");
const assert = require("assert");
const process = require("process");

const stripHexPrefix = utils.stripHexPrefix;

const logger = process[Symbol.for("loggerConsensus")];

const SENDER_STATE_IDLE = 1;
const SENDER_STATE_PROCESSING = 2;
const SENDER_STATE_FINISH = 3;

class Sender
{
	constructor(handler, expiration)
	{
		this.handler = handler;
		this.expiration = expiration;

		this.consensusBeginTime = 0;
		this.consensusTimeConsume = 0;

		this.state = SENDER_STATE_IDLE;

		this.finishAddresses = new Set()
		this.timeoutAddresses = new Set();
	}

	/**
	 * @param {String} address
	 */
	recordFinishNode(address)
	{
		assert(typeof address === "string", `Sender recordFinishNode, address should be a String, now is ${typeof address}`);

		if(this.state !== SENDER_STATE_PROCESSING)
		{
			return;
		}
		if(this.finishAddresses.has(address))
		{
			logger.error(`Sender recordFinishNode, address ${address} send the same consensus request`);
			return;
		}
		this.finishAddresses.add(address);

		// check if all nodes is active
		let i;
		for(i = 0; i < unl.length; i++)
		{
			if(!this.finishAddresses.has(stripHexPrefix(unl[i].address)))
			{
				break;
			}
		}

		if(i === unl.length)
		{
			this.consensusTimeConsume = Date.now() - this.consensusBeginTime;
			this.state = SENDER_STATE_FINISH;

			clearTimeout(this.timeout);

			this.handler(true);
		}
	}

	initFinishTimeout()
	{
		this.consensusBeginTime = Date.now();

		this.state = SENDER_STATE_PROCESSING;

		this.timeout = setTimeout(() => {
			// record timeout nodes
			for(let i = 0; i < unl.length; i++)
			{
				if(!this.finishAddresses.has(stripHexPrefix(unl[i].address)))
				{
					this.timeoutAddresses.add(stripHexPrefix(unl[i].address));
				}
			}

			this.consensusTimeConsume = Date.now() - this.consensusBeginTime;
			this.state = SENDER_STATE_FINISH;

			this.handler(false);
		}, this.expiration);
	}

	reset()
	{
		clearTimeout(this.timeout);

		this.state = SENDER_STATE_IDLE;

		this.consensusBeginTime = 0;
		this.consensusTimeConsume = 0;

		this.finishAddresses = new Set();
		this.timeoutAddresses = new Set();
	}
}

module.exports = Sender;