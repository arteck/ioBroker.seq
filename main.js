'use strict';

const utils = require('@iobroker/adapter-core');
const seq = require('seq-logging');
const adapterName = require('./package.json').name.split('.').pop();
let messageTemplate;
let systemName;
let hostName;
let nodeVersion;
let platform;
let arch;
const sourceVerions = []

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
        this.on('objectChange', this.onObjectChange.bind(this));
    }

    async onReady() {

        // Get Config
        let serverUrl = this.config.url;
        const serverPort = this.config.port;
        const apiKey = this.config.apiKey;
        messageTemplate = this.config.template;
        systemName = this.config.systemName;

        // Check Server address
        if (!serverUrl || serverUrl === '' || (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://'))) {
            this.log.warn('Server address is not a valid, please check your settings!')
            return;
        }

        // Check Server port
        if (!serverPort || serverPort === '') {
            this.log.warn('No server port configured, please check your settings!')
            return;
        }

        // Check Message template
        if (!messageTemplate || messageTemplate === '' || !messageTemplate.includes('{Message}')) {
            this.log.warn('Invalid message template, please check your settings!')
            return;
        }

        // Set which log events have been activated
        let subscribedEvents = [];
        seqEventConfig.forEach(x => {
            x.Active = this.config[x.LogLvl];
            if (x.Active) {
                subscribedEvents.push(x.LogLvl);
            }
        });

        // Check if a log event was activated
        if (seqEventConfig.filter(x => x.Active).length === 0) {
            this.log.warn('No log events were subscribed, please check your settings!')
            return;
        }

        // If the server address ends with /, this must be removed.
        if (serverUrl.endsWith('/')){
            serverUrl = serverUrl.slice(0, -1);
        }

        // Show subscribed events     
        this.log.info(`Log events [${subscribedEvents.join(' ,')}] subscribed`)

        // Activate Log Transporter
        // https://github.com/ioBroker/ioBroker.js-controller/blob/master/doc/LOGGING.md
        this.requireLog(true);
        this.on('log', this.onLog.bind(this));
        
        // Subscribe all adapters in case the versions change here  
        this.subscribeForeignObjects('system.adapter.*');
       
        // Build host systemPath
        hostName = `system.host.${this.host}`;
        // Get host object
        const hostObj = await this.getForeignObjectAsync(hostName);
        // Get host / JS-Controller version
        sourceVerions[hostName] = hostObj.common.installedVersion;
        // Get node version
        nodeVersion = hostObj.native.process.versions.node;
        // Get platform
        platform = hostObj.native.os.platform;
        // Get arch
        arch = hostObj.native.os.arch;

        // Init SeqLogger 
        seqLogger = new seq.Logger({
            serverUrl: serverUrl + ':' + serverPort,
            apiKey: apiKey
        });
    }

    // Subscribe all adapters in case the versions change here  
    async onObjectChange(id, obj){
        sourceVerions[obj._id] = obj.common.version;
    }

    async onLog(data) {
        // Get seqLogLvlMap for event
        const seqLogObj = seqEventConfig.find(x => x.LogLvl === data.severity);
        // Extract pid and message from event message
        const msgObj = this.ExtractPidAndMessage(data.message);
        if (msgObj == undefined){
            return;
        }

        // Check if eventLvl activate
        if (seqLogObj.Active) {        
            // Check if the sources should be logged
            if (this.config['allLogs'] || this.config[data.from]) {
               
                // Create systemPath
                let systemPath;
                if(data.from.startsWith('host.')){
                    systemPath = `system.${data.from}`;
                }
                else{
                    systemPath = `system.adapter.${data.from}`;
                }

                // Get version from source adapter  
                if (!sourceVerions[systemPath]){
                    sourceVerions[systemPath] = (await this.getForeignObjectAsync(systemPath)).common.version;
                }                
                const sourceVerion = sourceVerions[systemPath];
                
                // Send to seq instantz
                seqLogger.emit({
                    timestamp: new Date(data.ts).toISOString(),
                    level: seqLogObj.SeqLogLvl,
                    messageTemplate: messageTemplate.replace('{Message}', msgObj.Message),
                    properties: {
                        SystemName: systemName,
                        Application: 'ioBroker',                        
                        Source: data.from,
                        SourceVersion: sourceVerion,
                        JsController: sourceVerions[hostName],
                        Node: nodeVersion,
                        Platform: platform,
                        Arch: arch,
                        Pid: msgObj.Pid
                    }
                });
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
        try {
            const mIndex = Object.values(this.IndexesOf(inMessage, / /g))[0][1];
            const pIndex = Object.values(this.IndexesOf(inMessage, / /g))[0][0];
            let message = inMessage.substring(mIndex).trim();
            let pid = inMessage.substring(pIndex, mIndex).replace('(', '').replace(')', '').trim();
    
            // check if the message contains a pit, if not the object must fill differently
            if (isNaN(pid)) {
                message = inMessage.substring(pIndex).trim();
                pid = -1;
            }
    
            return {
                Message: message,
                Pid: parseInt(pid)
            };
            
        } catch (err) {
            this.log.error(`Cannot extract log pid and message: ${ex}`);
            return undefined;
        }
       
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