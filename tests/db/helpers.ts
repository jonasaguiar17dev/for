import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { Client } from "pg";

const root = path.resolve(__dirname, "../..");

/** Recria o banco de teste e aplica o stub do Supabase + todas as migrations. */
export async function resetDatabase(url: string): Promise<Client> {
  const dbName = new URL(url).pathname.slice(1);
  const maintenance = new Client({ connectionString: url.replace(/\/[^/]+$/, "/postgres") });
  await maintenance.connect();
  await maintenance.query(`drop database if exists "${dbName}" with (force)`);
  await maintenance.query(`create database "${dbName}"`);
  await maintenance.end();

  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(readFileSync(path.join(root, "supabase/tests/supabase_stub.sql"), "utf8"));
  const dir = path.join(root, "supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await client.query(readFileSync(path.join(dir, file), "utf8"));
  }
  return client;
}

/** Executa como usuário autenticado (role authenticated + claims), com RLS. */
export function makeAsUser(admin: Client) {
  return async function asUser<T>(userId: string, fn: (c: Client) => Promise<T>): Promise<T> {
    await admin.query("begin");
    try {
      await admin.query("set local role authenticated");
      await admin.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: "authenticated" }),
      ]);
      const result = await fn(admin);
      await admin.query("commit");
      return result;
    } catch (error) {
      await admin.query("rollback");
      throw error;
    }
  };
}

export async function createUser(admin: Client, id: string, email: string) {
  await admin.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
}
