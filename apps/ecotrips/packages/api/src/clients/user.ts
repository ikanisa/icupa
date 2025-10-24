import type { AutonomyPreferencesResponse, AutonomyPreferencesUpsertInput } from "@ecotrips/types";

import type { FunctionCaller, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";

export type UserClient = {
  getAutonomyPreferences(options?: RequestOptions): Promise<AutonomyPreferencesResponse>;
  saveAutonomyPreferences(
    input: AutonomyPreferencesUpsertInput,
    options?: RequestOptions,
  ): Promise<AutonomyPreferencesResponse>;
};

export function createUserClient(client: FunctionCaller<FunctionMap>): UserClient {
  return {
    getAutonomyPreferences(options) {
      return client.call("user.autonomy.get", {} as never, options);
    },
    saveAutonomyPreferences(input, options) {
      return client.call("user.autonomy.save", input, options);
    },
  };
}
