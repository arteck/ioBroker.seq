'use strict';

const utils = require('@iobroker/adapter-core');
const { buildServerUrl, isSourceAllowed, parseLogMessage, parseSourceFilter } = require('./lib/seq-utils');
const adapterName = require('./package.json').name.split('.').pop();

const SEQ_LOG_LEVELS = [
    { adapterLevel: 'silly', seqLevel: 'Verbose' },
    { adapterLevel: 'debug', seqLevel: 'Debug' },
    { adapterLevel: 'info', seqLevel: 'Information' },
    { adapterLevel: 'warn', seqLevel: 'Warning' },
    { adapterLevel: 'error', seqLevel: 'Error' },
];

class Seq extends utils.Adapter {
    constructor(options) {
        super({
            ...options,
            name: adapterName,
        });

        this.sourceVersions = new Map();
        this.logLevels = new Map();
        this.sourceFilter = null;
        this.messageTemplate = '';
        this.systemName = 'ioBroker';
        this.hostName = '';
        this.nodeVersion = process.version;
        this.platform = process.platform;
        this.arch = process.arch;
        this.seqLogger = null;

        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
    }

    async onReady() {
        let serverUrl;
        try {
            serverUrl = buildServerUrl(this.config.url, this.config.port);
        } catch (error) {
            return this.log.error(`Invalid Seq server URL or port: ${error.message}`);
        }

        this.messageTemplate = this.config.template;
        if (typeof this.messageTemplate !== 'string' || !this.messageTemplate.includes('{Message}')) {
            return this.log.error('Invalid message template; it must include {Message}.');
        }

        this.systemName = this.config.systemName || 'ioBroker';
        try {
            this.sourceFilter = parseSourceFilter(this.config.sourceFilter);
        } catch (error) {
            return this.log.error(`Invalid source filter: ${error.message}`);
        }
        this.logLevels = new Map(
            SEQ_LOG_LEVELS.filter(({ adapterLevel }) => this.config[adapterLevel]).map(({ adapterLevel, seqLevel }) => [
                adapterLevel,
                seqLevel,
            ]),
        );
        if (this.logLevels.size === 0) {
            return this.log.error('No log events were subscribed, please check your settings!');
        }

        this.log.debug(`Log events [${[...this.logLevels.keys()].join(', ')}] subscribed`);

        this.hostName = `system.host.${this.host}`;
        let hostObject;
        try {
            hostObject = await this.getForeignObjectAsync(this.hostName);
        } catch (error) {
            this.log.warn(`Could not read host information: ${error.message}`);
        }

        if (!hostObject) {
            this.log.warn(`Host object ${this.hostName} is unavailable; using fallback host information.`);
        }
        this.sourceVersions.set(this.hostName, hostObject?.common?.installedVersion || 'n/a');
        this.nodeVersion = hostObject?.native?.process?.versions?.node || process.version;
        this.platform = hostObject?.native?.os?.platform || process.platform;
        this.arch = hostObject?.native?.os?.arch || process.arch;

        let Logger;
        try {
            ({ Logger } = await import('seq-logging'));
        } catch (error) {
            return this.log.error(`Could not load seq-logging: ${error.message}`);
        }
        this.seqLogger = new Logger({
            serverUrl,
            apiKey: this.config.apiKey || undefined,
            onError: error => this.log.error(`Seq transport error: ${String(error)}`),
        });

        this.subscribeForeignObjects('system.adapter.*');
        if (typeof this.requireLog !== 'function') {
            this.log.error('Log transport is not available; cannot subscribe to ioBroker logs.');
            return;
        }
        this.requireLog(true);
        this.on('log', this.onLog.bind(this));
    }

    onObjectChange(id, obj) {
        if (obj) {
            this.sourceVersions.set(id, obj.common?.version || 'n/a');
        } else {
            this.sourceVersions.delete(id);
        }
    }

    async onLog(data) {
        const seqLevel = this.logLevels.get(data?.severity);
        if (!seqLevel) {
            return;
        }

        if (typeof data?.from !== 'string') {
            this.log.warn('Ignoring log event without a source.');
            return;
        }
        if (!isSourceAllowed(data.from, this.sourceFilter)) {
            return;
        }

        const parsedMessage = parseLogMessage(data.message);
        if (!parsedMessage) {
            this.log.warn('Ignoring log event without a string message.');
            return;
        }

        const timestamp = new Date(data.ts);
        if (Number.isNaN(timestamp.getTime())) {
            this.log.warn('Ignoring log event with an invalid timestamp.');
            return;
        }

        const sourceObjectId = data.from.startsWith('host.')
            ? `system.${data.from}`
            : `system.adapter.${data.from}`;
        if (!this.sourceVersions.has(sourceObjectId)) {
            try {
                const object = await this.getForeignObjectAsync(sourceObjectId);
                this.sourceVersions.set(sourceObjectId, object?.common?.version || 'n/a');
            } catch (error) {
                this.log.warn(`Could not read source version for ${sourceObjectId}: ${error.message}`);
                this.sourceVersions.set(sourceObjectId, 'n/a');
            }
        }

        if (!this.seqLogger) {
            this.log.error('Seq logger is not initialized; cannot forward the log event.');
            return;
        }
        this.seqLogger.emit({
            timestamp,
            level: seqLevel,
            messageTemplate: this.messageTemplate,
            properties: {
                Message: parsedMessage.message,
                SystemName: this.systemName,
                Application: 'ioBroker',
                Source: data.from,
                SourceVersion: this.sourceVersions.get(sourceObjectId),
                JsController: this.sourceVersions.get(this.hostName),
                Node: this.nodeVersion,
                Platform: this.platform,
                Arch: this.arch,
                Pid: parsedMessage.pid,
            },
        });
    }

    async onUnload(callback) {
        try {
            if (this.seqLogger) {
                await this.seqLogger.close();
            }
        } catch (error) {
            this.log.error(`Could not flush Seq logger during shutdown: ${String(error)}`);
        } finally {
            callback();
        }
    }
}

if (require.main !== module) {
    module.exports = options => new Seq(options);
} else {
    new Seq();
}
