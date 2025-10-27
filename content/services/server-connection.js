class ServerConnectionManager {
    constructor(logger) {
        this.serverUrl = 'http://localhost:5000';
        this.isServerRunning = false;
        this.logger = logger || console;
    }

    async checkServerConnection() {
        try {
            const response = await fetch(`${this.serverUrl}/health`, {
                method: 'GET',
                mode: 'cors'
            });
            
            if (response.ok) {
                const data = await response.json();
                this.logger.info('Server connected:', data);
                this.isServerRunning = true;
                return true;
            }
        } catch (error) {
            this.logger.error('Server not responding');
            this.isServerRunning = false;
            return false;
        }
        return false;
    }
}