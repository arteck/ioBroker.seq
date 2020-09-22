'use strict';

const utils = require('@iobroker/adapter-core');
const seq = require('seq-logging');
const adapterName = require('./package.json').name.split('.').pop();
let messageTemplate;

// Create Seq LogConfig
let seqEventConfig = [{
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

        // Get Config
        const _serverUrl = this.config.url;
        const _serverPort = this.config.port;
        const _apiKey = this.config.apiKey;
        messageTemplate = this.config.template;

        // Check Server address
        if (!_serverUrl || _serverUrl === '' || (!_serverUrl.startsWith('http://') && !_serverUrl.startsWith('https://'))) {
            this.log.warn('Server address is not a valid, please check your settings!')
            return;
        }

        // Check Server port
        if (!_serverPort || _serverPort === '') {
            this.log.warn('No server port configured, please check your settings!')
            return;
        }

        // Check Message template
        if (!messageTemplate || messageTemplate === '' || !messageTemplate.includes('{Message}')) {
            this.log.warn('Invalid message template, please check your settings!')
            return;
        }

        // Set which log events have been activated
        let _subscribedEvents = [];
        seqEventConfig.forEach(x => {
            x.Active = this.config[x.LogLvl];
            if (x.Active) {
                _subscribedEvents.push(x.LogLvl);
            }
        });

        // Check if a log event was activated
        if (seqEventConfig.filter(x => x.Active).length === 0) {
            this.log.warn('No log events were subscribed, please check your settings!')
            return;
        }

        // Show subscribed events     
        this.log.info(`Log events [${_subscribedEvents.join(' ,')}] subscribed`)

        // Activate Log Transporter
        // https://github.com/ioBroker/ioBroker.js-controller/blob/master/doc/LOGGING.md
        this.requireLog(true);
        this.on('log', this.onLog.bind(this));

        // Init SeqLogger 
        seqLogger = new seq.Logger({
            serverUrl: _serverUrl + ':' + _serverPort,
            apiKey: _apiKey
        });
    }

    onLog(data) {
        // Get seqLogLvlMap for event
        const _seqLogObj = seqEventConfig.find(x => x.LogLvl === data.severity);
        // Extract pid and message from event message
        const _msgObj = this.ExtractPidAndMessage(data.message);
        // Check if eventLvl activate
        if (_seqLogObj.Active) {
            try {
                seqLogger.emit({
                    timestamp: new Date(data.ts).toISOString(),
                    level: _seqLogObj.SeqLogLvl,
                    messageTemplate: messageTemplate.replace('{Message}', _msgObj.Message),
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
            // Flush logger 
            seqLogger.close();
            callback();
        } catch (ex) {
            callback();
        }
    }

    ExtractPidAndMessage(inMessage) {
        const _mIndex = Object.values(this.IndexesOf(inMessage, / /g))[0][1];
        const _pIndex = Object.values(this.IndexesOf(inMessage, / /g))[0][0];
        let _message = inMessage.substring(_mIndex).trim();
        let _pid = inMessage.substring(_pIndex, _mIndex).replace('(', '').replace(')', '').trim();

        // check if the message contains a pit, if not the object must fill differently
        if (isNaN(_pid)) {
            _message = inMessage.substring(_pIndex).trim();
            _pid = -1;
        }

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