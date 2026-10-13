import { readConfig } from './config.js';
import { SupabaseGateway } from './supabase-gateway.js';
import { createApp } from './app.js';
const config = readConfig();
const server = createApp(config, config.ready ? new SupabaseGateway(config) : null);
server.requestTimeout=15000; server.headersTimeout=10000;
server.listen(config.port, () => console.log(`RosterCast account server listening on port ${config.port}; accounts ${config.ready ? 'configured' : 'not configured'}.`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>process.exit(0)));
