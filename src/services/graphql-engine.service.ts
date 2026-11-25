import type {
  GraphqlIntrospectParams,
  GraphqlSendParams,
} from "@/types/engine/graphql-engine.type";
import { engineBridge, unwrapEngine } from "./config/engine-bridge";

export const graphqlEngineService = {
  send: (params: GraphqlSendParams) =>
    unwrapEngine(engineBridge().sendGraphql(params)),
  introspect: (params: GraphqlIntrospectParams) =>
    unwrapEngine(engineBridge().introspectGraphql(params)),
  cancel: (runId: string) => unwrapEngine(engineBridge().cancel(runId)),
};
