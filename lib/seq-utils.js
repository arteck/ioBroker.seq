'use strict';

/**
 * Validates the Seq URL and port, then returns the ingestion server base URL.
 *
 * @param {unknown} serverUrl The configured Seq URL.
 * @param {unknown} serverPort The configured Seq port.
 * @returns {string} The validated Seq base URL.
 */
function buildServerUrl(serverUrl, serverPort) {
    if (typeof serverUrl !== 'string' || !serverUrl.trim()) {
        throw new TypeError('Server URL is required.');
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(serverUrl.trim());
    } catch {
        throw new TypeError('Server URL must be a valid absolute URL.');
    }

    if (
        (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') ||
        !parsedUrl.hostname ||
        parsedUrl.username ||
        parsedUrl.password ||
        parsedUrl.search ||
        parsedUrl.hash
    ) {
        throw new TypeError('Server URL must use HTTP(S) and must not contain credentials, a query, or a fragment.');
    }

    if ((typeof serverPort !== 'string' && typeof serverPort !== 'number') || !String(serverPort).trim()) {
        throw new TypeError('Server port is required.');
    }
    const port = Number(serverPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new TypeError('Server port must be an integer between 1 and 65535.');
    }

    parsedUrl.port = String(port);
    return parsedUrl.href.replace(/\/$/, '');
}

/**
 * Parses comma-separated exact source IDs. An empty filter means all sources.
 *
 * @param {unknown} sourceFilter The configured source filter.
 * @returns {Set<string> | null} The set of exact source IDs, or null for all sources.
 */
function parseSourceFilter(sourceFilter) {
    if (sourceFilter == null) {
        return null;
    }
    if (typeof sourceFilter !== 'string') {
        throw new TypeError('Source filter must be a comma-separated string.');
    }

    const sources = new Set(sourceFilter.split(',').map(source => source.trim()).filter(Boolean));
    return sources.size > 0 ? sources : null;
}

/**
 * Checks whether a source passes the configured exact-ID filter.
 *
 * @param {string} source The source ID from the log event.
 * @param {Set<string> | null} sourceFilter The parsed source filter.
 * @returns {boolean} Whether the source is included.
 */
function isSourceAllowed(source, sourceFilter) {
    return !sourceFilter || sourceFilter.has(source);
}

/**
 * Extracts a leading process ID while preserving messages without a PID.
 *
 * @param {unknown} message The message supplied by the ioBroker log transport.
 * @returns {{ message: string, pid: number } | null} The parsed event, or null for empty input.
 */
function parseLogMessage(message) {
    if (typeof message !== 'string' || !message.trim()) {
        return null;
    }

    const normalizedMessage = message.trim();
    const pidMatch = /^(?:\S+\s+)?\(?(\d+)\)?\s+(.*)$/s.exec(normalizedMessage);
    if (!pidMatch) {
        return { message: normalizedMessage, pid: -1 };
    }

    return {
        message: pidMatch[2].trim(),
        pid: Number(pidMatch[1]),
    };
}

module.exports = {
    buildServerUrl,
    isSourceAllowed,
    parseLogMessage,
    parseSourceFilter,
};
