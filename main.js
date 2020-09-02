'use strict';

/*
 * Created with @iobroker/create-adapter v1.26.3
 */

const utils = require('@iobroker/adapter-core');
const seq = require('seq-logging');
var logger;
var verboseActive;
var debugActive;
var infomationActive;
var warningActive;
var errorActive;


class Seq extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'seq',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));

        /*
		    adapter.requireLog(true);
			adapter.on('log', function(logObject) {
				// Here we have the log in "logObject" and can handle it accordingly.
				const severity = logObject.severity; // the log level (severity): info, warn, error, etc.
				// ....
			});
		*/
    }

    async onReady() {

        let _serverUrl = this.config.url;
        let _serverPort = this.config.port;
        let _apiKey = this.config.apiKey;

        logger = new seq.Logger({ serverUrl: _serverUrl + ':' + _serverPort, apiKey: _apiKey });
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            logger.close();
            callback();
        } catch (e) {
            callback();
        }
    }
}

function SeqLog(logLevel, source, message) {
    logger.emit({
        timestamp: new Date(),
        level: logLevel,
        messageTemplate: '{Source}: ' + message,
        properties: {
            Application: 'ioBroker',
            Source: source
        }
    });
}

function createMessageObj(inMessage) {
    const index = Object.values(indexesOf(inMessage, / /g))[0][1];
    const message = inMessage.substring(index);
    return { message: message }
}

function indexesOf(string, regex) {
    var match, indexes = {};
    regex = new RegExp(regex);
    while (match = regex.exec(string)) {
        if (!indexes[match[0]]) indexes[match[0]] = [];
        indexes[match[0]].push(match.index);
    }
    return indexes;
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Seq(options);
} else {
    // otherwise start the instance directly
    new Seq();
}