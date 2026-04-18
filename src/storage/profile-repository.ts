import type { Database } from "./database.js";
import type { UserProfile } from "../core/types.js";

export class ProfileRepository {
  constructor(private readonly database: Database) {}

  load(scope = "global"): UserProfile {
    const row = this.database.connection
      .prepare(`
        SELECT
          scope,
          confirmed_json AS confirmedJson,
          inferred_json AS inferredJson,
          signals_json AS signalsJson,
          updated_at AS updatedAt
        FROM profiles
        WHERE scope = ?
      `)
      .get(scope) as
      | {
          scope: string;
          confirmedJson: string;
          inferredJson: string;
          signalsJson: string;
          updatedAt: string;
        }
      | undefined;

    if (!row) {
      return {
        scope,
        confirmed: {},
        inferred: {},
        signals: {},
        updatedAt: ""
      };
    }

    return {
      scope: row.scope,
      confirmed: JSON.parse(row.confirmedJson) as Record<string, unknown>,
      inferred: JSON.parse(row.inferredJson) as Record<string, unknown>,
      signals: JSON.parse(row.signalsJson) as Record<string, unknown>,
      updatedAt: row.updatedAt
    };
  }

  save(profile: UserProfile): UserProfile {
    this.database.connection
      .prepare(`
        INSERT INTO profiles (scope, confirmed_json, inferred_json, signals_json, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(scope) DO UPDATE SET
          confirmed_json = excluded.confirmed_json,
          inferred_json = excluded.inferred_json,
          signals_json = excluded.signals_json,
          updated_at = excluded.updated_at
      `)
      .run(
        profile.scope,
        JSON.stringify(profile.confirmed),
        JSON.stringify(profile.inferred),
        JSON.stringify(profile.signals),
        profile.updatedAt
      );

    return profile;
  }
}
