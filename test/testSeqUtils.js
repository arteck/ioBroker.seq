'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('mocha');
const { buildServerUrl, isSourceAllowed, parseLogMessage, parseSourceFilter } = require('../lib/seq-utils');

describe('Seq adapter utility functions', () => {
    describe('buildServerUrl', () => {
        it('combines a valid HTTP(S) URL and port', () => {
            assert.equal(buildServerUrl('https://seq.example.test/', '5341'), 'https://seq.example.test:5341');
            assert.equal(buildServerUrl('http://seq.example.test/base', 8080), 'http://seq.example.test:8080/base');
        });

        it('rejects unsupported URLs and invalid ports', () => {
            assert.throws(() => buildServerUrl('ftp://seq.example.test', 5341), /HTTP\(S\)/);
            assert.throws(() => buildServerUrl('http://seq.example.test', 0), /between 1 and 65535/);
            assert.throws(() => buildServerUrl('http://user:pass@seq.example.test', 5341), /credentials/);
        });
    });

    describe('source filtering', () => {
        it('parses exact comma-separated source IDs and allows all when empty', () => {
            const filter = parseSourceFilter(' mqtt.0, javascript.0, ,');
            assert.ok(filter);
            assert.equal(filter.size, 2);
            assert.equal(isSourceAllowed('mqtt.0', filter), true);
            assert.equal(isSourceAllowed('mqtt.1', filter), false);
            assert.equal(isSourceAllowed('mqtt.0', parseSourceFilter('')), true);
        });

        it('rejects non-string filter configuration', () => {
            assert.throws(() => parseSourceFilter(42), /comma-separated string/);
        });
    });

    describe('parseLogMessage', () => {
        it('extracts a PID from both common log prefixes', () => {
            assert.deepEqual(parseLogMessage('(123) adapter started'), { message: 'adapter started', pid: 123 });
            assert.deepEqual(parseLogMessage('mqtt.0 (456) connected'), { message: 'connected', pid: 456 });
        });

        it('preserves messages without a PID and rejects empty/non-string input', () => {
            assert.deepEqual(parseLogMessage('plain log message'), { message: 'plain log message', pid: -1 });
            assert.equal(parseLogMessage('  '), null);
            assert.equal(parseLogMessage(undefined), null);
        });
    });
});
