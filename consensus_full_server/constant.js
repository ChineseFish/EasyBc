module.exports.TRANSACTION_CACHE_MAX_NUM = 500;
module.exports.MAX_PROCESS_TRANSACTIONS_SIZE = 100;

// stage 
module.exports.STAGE_DATA_EXCHANGE_TIMEOUT = 2000;
module.exports.STAGE_STAGE_SYNCHRONIZE_TIMEOUT = 1000;

module.exports.STAGE_MAX_FINISH_RETRY_TIMES = 3;

module.exports.STAGE_STATE_EMPTY = 1;
module.exports.STAGE_STATE_DATA_EXCHANGE_PROCEEDING = 2;
module.exports.STAGE_STATE_DATA_EXCHANGE_FINISH_SUCCESS_AND_SYNCHRONIZE_PROCEEDING = 3;
module.exports.STAGE_STATE_DATA_EXCHANGE_FINISH_TIMEOUT_AND_SYNCHRONIZE_PROCEEDING = 4;

module.exports.AVERAGE_TIME_STATISTIC_MAX_TIMES = 200;

// ripple
module.exports.RIPPLE_STAGE_AMALGAMATE = 1;
module.exports.RIPPLE_STAGE_CANDIDATE_AGREEMENT = 2;
module.exports.RIPPLE_STAGE_BLOCK_AGREEMENT = 3;
module.exports.RIPPLE_STAGE_BLOCK_AGREEMENT_PROCESS_BLOCK = 4;

module.exports.RIPPLE_STATE_STAGE_CONSENSUS = 1;
module.exports.RIPPLE_STATE_TRANSACTIONS_CONSENSUS = 2;

module.exports.RIPPLE_MAX_ROUND = 2000;

// amalgamate
module.exports.PROTOCOL_CMD_CANDIDATE_AMALGAMATE = 100;
module.exports.PROTOCOL_CMD_CANDIDATE_AMALGAMATE_FINISH_STATE_REQUEST = 101;
module.exports.PROTOCOL_CMD_CANDIDATE_AMALGAMATE_FINISH_STATE_RESPONSE = 102;

// candidate agreement
module.exports.PROTOCOL_CMD_CANDIDATE_AGREEMENT = 200;
module.exports.PROTOCOL_CMD_CANDIDATE_AGREEMENT_FINISH_STATE_REQUEST = 201;
module.exports.PROTOCOL_CMD_CANDIDATE_AGREEMENT_FINISH_STATE_RESPONSE = 202;

// block agreement
module.exports.PROTOCOL_CMD_BLOCK_AGREEMENT = 300;
module.exports.PROTOCOL_CMD_BLOCK_AGREEMENT_FINISH_STATE_REQUEST = 301;
module.exports.PROTOCOL_CMD_BLOCK_AGREEMENT_FINISH_STATE_RESPONSE = 302;

// counter
module.exports.PROTOCOL_CMD_INVALID_AMALGAMATE_STAGE = 400;
module.exports.PROTOCOL_CMD_INVALID_CANDIDATE_AGREEMENT_STAGE = 401;
module.exports.PROTOCOL_CMD_INVALID_BLOCK_AGREEMENT_STAGE = 402;
module.exports.PROTOCOL_CMD_ACOUNTER_REQUEST = 403;
module.exports.PROTOCOL_CMD_ACOUNTER_RESPONSE = 404;

module.exports.COUNTER_HANDLER_TIME_DETAY = 2000;
module.exports.COUNTER_INVALID_STAGE_TIME_SECTION = 2000;

module.exports.COUNTER_STATE_IDLE = 1;
module.exports.COUNTER_STATE_PROCESSING = 2;

module.exports.COUNTER_CONSENSUS_STAGE_THRESHOULD = 0.5;

// Perish
module.exports.PROTOCOL_CMD_KILL_NODE_REQUEST = 500;
module.exports.PROTOCOL_CMD_KILL_NODE_STATUS_REQUEST = 501;
module.exports.PROTOCOL_CMD_KILL_NODE_STATUS_RESPONSE = 502;

module.exports.PERISH_STATUS_IDLE = 1;
module.exports.PERISH_STATUS_PROCESSING = 2;
module.exports.PERISH_STATUS_FINISH = 3;

module.exports.PERISH_DATA_STATE_NOT_KILLED = 1;
module.exports.PERISH_DATA_STATE_KILLING = 2;
module.exports.PERISH_DATA_STATE_KILLED = 3;

module.exports.PERISH_MAX_FINISH_RETRY_TIMES = 3;
module.exports.PERISH_FINISH_TIMEOUT = 2000;

module.exports.PERISH_VALID_THRESHOULD = 0.8;
module.exports.PERISH_CHEATED_THRESHOULD = 0.5;

//
module.exports.TRANSACTIONS_CONSENSUS_THRESHOULD = 0.8;