'use strict';

/*
 * Created with @iobroker/create-adapter v1.26.3
 */

const utils = require('@iobroker/adapter-core');
const seq = require('seq-logging');
let logger;
let verboseActive;
let debugActive;
let infomationActive;
let warningActive;
let errorActive;


class Seq extends utils.Adapter {

    constructor(options) {
        super({
            ...options,
            name: 'seq',
        });

        //this.requireLog(true);
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this.on('log', this.onLog.bind(this));
    }


    async onReady() {

        const _serverUrl = this.config.url;
        const _serverPort = this.config.port;
        const _apiKey = this.config.apiKey;

        this.log.warn('config : ' + _serverUrl);
        this.log.warn('config : ' + _serverPort);
        this.log.warn('config : ' + _apiKey);

        logger = new seq.Logger({
            serverUrl: _serverUrl + ':' + _serverPort,
            apiKey: _apiKey
        });
    }

    onLog(data) {
        this.log.warn('config : ' + data);
        const _seqLogLvl = this.GetSeqLogLvl(data.severity);
        const _message = this.createMessageObj(data.message);
        this.SeqLog(seqLogLvl, data.ts, data.from, data.message);
    }

    onUnload(callback) {
        try {
            logger.close();
            callback();
        } catch (e) {
            callback();
        }
    }

    GetSeqLogLvl(data) {
        let _seqLogLvl;

        switch (data) {
            case 'silly':
                _seqLogLvl = 'Verbose';
                break;
            case 'debug':
                _seqLogLvl = 'Debug';
                break;
            case 'info':
                _seqLogLvl = 'Information';
                break;
            case 'warn':
                _seqLogLvl = 'Warning';
                break;
            case 'error':
                _seqLogLvl = 'Error';
                break;
            default:
                _seqLogLvl = '';
        }

        return _seqLogLvl;
    }

    SeqLog(logLevel, ts, from, message) {
        logger.emit({
            timestamp: ts,
            level: logLevel,
            messageTemplate: '{Source}: ' + message,
            properties: {
                Application: 'ioBroker',
                Source: from
            }
        });
    }

    createMessageObj(inMessage) {
        const index = Object.values(this.indexesOf(inMessage, / /g))[0][1];
        const message = inMessage.substring(index);
        return message;
    }

    indexesOf(string, regex) {
        let match, indexes = {};
        regex = new RegExp(regex);
        while (match = regex.exec(string)) {
            if (!indexes[match[0]]) indexes[match[0]] = [];
            indexes[match[0]].push(match.index);
        }
        return indexes;
    }
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