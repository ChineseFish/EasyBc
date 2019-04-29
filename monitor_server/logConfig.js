const log4js = require("log4js")
 
log4js.configure({
    replaceConsole: true,
    appenders: {
        stdout: {
            type: "stdout"
        },
        req: {
            type: "dateFile",
            filename: "monitor_server/logs/req_log/",
            pattern: "req-yyyy-MM-dd.log",
            alwaysIncludePattern: true
        },
        db: {
            type: "dateFile",
            filename: "monitor_server/logs/db_log/",
            pattern: "db-yyyy-MM-dd.log",
            alwaysIncludePattern: true
        }
    },
    categories: {
        default: { appenders: ["stdout", "req"], level: "debug" },
        db: { appenders: ["stdout", "db"], level: "debug" }
    }
})
 
 
exports.getLogger = function(name)
{
    return log4js.getLogger(name || "default");
}

/**
 * @param {Express} app express instance
 * @param {Log4js} logger 
 */
exports.useLogger = function(app, logger)
{
    app.use(log4js.connectLogger(logger || log4js.getLogger("default"), {
        format: "[:remote-addr :method :url :status :response-timems][:referrer HTTP/:http-version :user-agent]"
    }));
}