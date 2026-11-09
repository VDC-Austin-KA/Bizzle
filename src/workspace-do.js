// Cloudflare: each client workspace is its own Durable Object with its own SQLite database.
import { DurableObject } from 'cloudflare:workers';
import { WorkspaceStore, WORKSPACE_METHODS } from './workspace.js';

export class ClientWorkspace extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.store = new WorkspaceStore((sql, ...p) => ctx.storage.sql.exec(sql, ...p).toArray(), { masterKey: env.WORKSPACE_KEY });
  }
  async call(method, ...args) {
    if (!WORKSPACE_METHODS.has(method)) throw new Error('Not allowed');
    return this.store[method](...args);
  }
}

export const doWorkspaces = (env) => (id) => {
  if (!/^[0-9a-f]{32}$/.test(id)) throw new Error('Invalid workspace id');
  const stub = env.WORKSPACES.get(env.WORKSPACES.idFromName(id));
  return { call: (m, ...a) => stub.call(m, ...a) };
};
