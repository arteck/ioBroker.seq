'use strict';

// Todo prüfen ob Config vorhanden...
// Todo Logausgaben...

const utils = require('@iobroker/adapter-core');
const seq = require('seq-logging');
const adapterName = require('./package.json').name.split('.').pop();

let seqLogLvlMap = {
    silly: { LogLvl: 'Verbose', Active: false },
    debug: { LogLvl: 'Debug', Active: false },
    info: { LogLvl: 'Information', Active: false },
    warn: { LogLvl: 'Warning', Active: false },
    error: { LogLvl: 'Error', Active: false }
};

let seqLogger;

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

        seqLogLvlMap['silly'].Active = this.config.silly;
        seqLogLvlMap['debug'].Active = this.config.debug;
        seqLogLvlMap['info'].Active = this.config.info;
        seqLogLvlMap['warn'].Active = this.config.warn;
        seqLogLvlMap['error'].Active = this.config.error;

        this.requireLog(true);

        seqLogger = new seq.Logger({
            serverUrl: _serverUrl + ':' + _serverPort,
            apiKey: _apiKey
        });

    }

    onLog(data) {
        const _seqLogObj = seqLogLvlMap[data.severity];

        if (_seqLogObj.Active) {
            try {
                seqLogger.emit({
                    timestamp: new Date(data.ts).toISOString(),
                    level: _seqLogObj.LogLvl,
                    messageTemplate: '{Source}: ' + this.ExtractMessage(data.message),
                    properties: {
                        Application: 'ioBroker',
                        Source: data.from
                    }
                });
            } catch (e) {
                this.log.error(`Cannot send data to server: ${e}`);
            }
        }
    }

    onUnload(callback) {
        try {
            seqLogger.close();
            callback();
        } catch (e) {
            callback();
        }
    }

    ExtractMessage(inMessage) {
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
