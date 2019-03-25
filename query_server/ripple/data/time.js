const util = require("../../../utils")
const Base = require("./base")
const {checkNodeAddress} = require("../../nodes")

/**
 * Creates a new Time object
 *
 * @class
 * @constructor
 * @prop 
 */
class Time extends Base
{
	constructor(data)
	{
    super();

		data = data || {};

		// Define Properties
    const fields = [{
      name: "time",
      allowZero: true,
      default: util.Buffer.alloc(0)
    }, {
      name: "v",
      length: 1,
      allowZero: true,
      allowLess: true,
      default: util.Buffer.from([0x1c])
    }, {
      name: "r",
      length: 32,
      allowZero: true,
      allowLess: true,
      default: util.Buffer.alloc(0)
    }, {
      name: "s",
      length: 32,
      allowZero: true,
      allowLess: true,
      default: util.Buffer.alloc(0)
    }];

		/**
     * Returns the rlp encoding of the candidate
     * @method serialize
     * @memberof Transaction
     * @return {Buffer}
     */

    // attached serialize
    util.defineProperties(this, fields, data);
	}

  /**
   * get middle time
   */
	getTime()
	{
		for(let i = 0; i < this.length - 1; i++)
		{
			for(let j = 0; j < this.length - 1 - i; j++)
			{
				if(this.data[j] < this.data[j + 1])
				{
					let tmp = this.data[j];
					this.data[j] = this.data[j + 1];
					this.data[j + 1] = tmp;
				}
			}
		}

		return this.data[Math.ceil(this.length / 2)];
	}

  /**
   * @param {Array/Number} values
   */
  batchPush(values)
  {
    for(let i = 0; i < values.length; i++)
    {
      this.push(values[i]);
    }
  }
  /**
   * @param {Number} value
   */
  push(value)
  {
    this.data.push(value);  
  }

  /**
   * @param {Array/Object|Buffer} values
   */
  batchDel(values)
  {
    throw new Error("class Time, func batchDel no exist");
  }
  /**
   * @param {Object|Buffer} value
   */
  del(value)
  {
    throw new Error("class Time, func del no exist");
  }

  /*
   *
   */
  ifExist()
  {
    throw new Error("class Time, func ifExist no exist");
  }

  /**
   * Validates the signature
   * Checks time's property and signature
   * @param {Boolean} [stringError=false] whether to return a string with a description of why the validation failed or return a Boolean
   * @return {Boolean|String}
   */
  validateSignatrue(stringError)
  {
    const errors = [];

    // verify
    if(!this.verifySignature())
    {
      errors.push("class Time validateSignatrue, Invalid Time Signature");
    }

    // check address
    if(!checkNodeAddress(this.from))
    {
    	errors.push("class Time validateSignatrue, Invalid Time address");
    }

    if(stringError === undefined || stringError === false)
    {
      return errors.length === 0;
    }
    else
    {
      return errors.join(" ");
    }
  }
}

module.exports = Time;