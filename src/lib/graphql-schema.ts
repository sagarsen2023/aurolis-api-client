import {
  buildClientSchema,
  type GraphQLSchema,
  type IntrospectionQuery,
} from "graphql";

const cache = new WeakMap<object, GraphQLSchema | null>();

export function schemaFromIntrospection(
  introspection: Record<string, unknown> | undefined,
): GraphQLSchema | null {
  if (!introspection) return null;
  const cached = cache.get(introspection);
  if (cached !== undefined) return cached;
  let schema: GraphQLSchema | null;
  try {
    schema = buildClientSchema(introspection as unknown as IntrospectionQuery);
  } catch {
    schema = null;
  }
  cache.set(introspection, schema);
  return schema;
}
