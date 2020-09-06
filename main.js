'use strict';

const utils = require('@iobroker/adapter-core');
const seq = require('seq-logging');
const adapterName = require('./package.json').name.split('.').pop();

const seqLogLvlMap = {
    'silly': 'Verbose',
    'debug': 'Debug',
    'info': 'Information',
    'warn': 'Warning',
    'error': 'Error'
};
let logger;

class Seq extends utils.Adapter {

    constructor(options) {
        super({
            ...options,
            name: adapterName,
        });



        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this.on('log', this.onLog.bind(this));
    }

    onReady() {
        const _serverUrl = this.config.url;
        const _serverPort = this.config.port;
        const _apiKey = this.config.apiKey;
        this.requireLog(true);

        logger = new seq.Logger({
            serverUrl: _serverUrl + ':' + _serverPort,
            apiKey: _apiKey
        });
    }

    onLog(data) {
        const _seqLogLvl = seqLogLvlMap[data.severity];
        const _message = this.CreateMessageObj(data.message);
        this.SeqLog(_seqLogLvl, data.ts, data.from, _message);
    }

    onUnload(callback) {
        try {
            logger.close();
            callback();
        } catch (e) {
            callback();
        }
    }

    SeqLog(logLevel, ts, from, message) {
        logger.emit({
            timestamp: new Date(ts).toISOString(),
            level: logLevel,
            messageTemplate: '{Source}: ' + message,
            properties: {
                Application: 'ioBroker',
                Source: from
            }
        });
    }

    CreateMessageObj(inMessage) {
        const index = Object.values(this.IndexesOf(inMessage, / /g))[0][1];
        const message = inMessage.substring(index);
        return message;
    }

    IndexesOf(string, regex) {
        let match, indexes = {};
        regex = new RegExp(regex);
        while (match = regex.exec(string)) {
            if (!indexes[match[0]]) indexes[match[0]] = [];
            indexes[match[0]].push(match.index);
        }
        return indexes;
    }
}

if (module.parent) {
    module.exports = (options) => new Seq(options);
} else {
    new Seq();
}