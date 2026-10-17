declare global {
    namespace ioBroker {
        interface AdapterConfig {
            url: string;
            port: string | number;
            apiKey: string;
            template: string;
            systemName: string;
            sourceFilter: string;
            silly: boolean;
            debug: boolean;
            info: boolean;
            warn: boolean;
            error: boolean;
        }
    }
}

export {};
