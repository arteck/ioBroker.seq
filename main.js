'use strict';

const utils = require('@iobroker/adapter-core');
const seq = require('seq-logging');
const adapterName = require('./package.json').name.split('.').pop();

let seqLogLvlMap = [{
        LogLvl: 'silly',
        SeqLogLvl: 'Verbose',
        Active: false
    },
    {
        LogLvl: 'debug',
        SeqLogLvl: 'Debug',
        Active: false
    },
    {
        LogLvl: 'info',
        SeqLogLvl: 'Information',
        Active: false
    },
    {
        LogLvl: 'warn',
        SeqLogLvl: 'Warning',
        Active: false
    },
    {
        LogLvl: 'error',
        SeqLogLvl: 'Error',
        Active: false
    }
];

let seqLogger;

class Seq extends utils.Adapter {

    constructor(options) {
        super({
            ...options,
            name: adapterName,
        });

        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    onReady() {
        const _serverUrl = this.config.url;
        const _serverPort = this.config.port;
        const _apiKey = this.config.apiKey;



        // Check which log events have been activated
        let _subscribedEvents = [];
        seqLogLvlMap.forEach(x => {
            x.Active = this.config[x.LogLvl];
            if (x.Active) {
                _subscribedEvents.push(x.LogLvl);
            }
        });
        this.log.info(`Log events [${_subscribedEvents.join(' ,')}] subscribed`)

        // Check if a log event was activated
        if (seqLogLvlMap.filter(x => x.Active).length === 0) {
            this.log.warn('No log events were subscribed, please check your settings!')
            return;
        }

        this.requireLog(true);
        this.on('log', this.onLog.bind(this));

        seqLogger = new seq.Logger({
            serverUrl: _serverUrl + ':' + _serverPort,
            apiKey: _apiKey
        });
    }

    onLog(data) {
        const _seqLogObj = seqLogLvlMap.find(x => x.LogLvl === data.severity);
        const _msgObj = this.ExtractPidAndMessage(data.message);
        if (_seqLogObj.Active) {
            try {
                seqLogger.emit({
                    timestamp: new Date(data.ts).toISOString(),
                    level: _seqLogObj.SeqLogLvl,
                    messageTemplate: '{Source}: ' + _msgObj.Message,
                    properties: {
                        Application: 'ioBroker',
                        Source: data.from,
                        Pid: _msgObj.Pid
                    }
                });
            } catch (ex) {
                this.log.error(`Cannot send data to server: ${ex}`);
            }
        }
    }

    onUnload(callback) {
        try {
            seqLogger.close();
            callback();
        } catch (ex) {
            callback();
        }
    }

    ExtractPidAndMessage(inMessage) {
        const _mIndex = Object.values(this.IndexesOf(inMessage, / /g))[0][1];
        const _pIndex = Object.values(this.IndexesOf(inMessage, / /g))[0][0];
        const _message = inMessage.substring(_mIndex).trim();
        const _pid = inMessage.substring(_pIndex, _mIndex).replace('(', '').replace(')', '').trim();
        return {
            Message: _message,
            Pid: parseInt(_pid)
        };
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
