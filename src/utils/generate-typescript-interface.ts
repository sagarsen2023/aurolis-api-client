type PrimitiveName = "string" | "number" | "boolean" | "null" | "unknown";

type Field = { type: TypeNode; optional: boolean };

type TypeNode =
  | { kind: "primitive"; name: PrimitiveName }
  | { kind: "never" }
  | { kind: "array"; element: TypeNode }
  | { kind: "object"; fields: Map<string, Field> }
  | { kind: "union"; members: TypeNode[] };

type InterfaceDeclaration = { name: string; body: string };

const NEVER: TypeNode = { kind: "never" };
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const PRIMITIVE_ORDER: PrimitiveName[] = [
  "string",
  "number",
  "boolean",
  "unknown",
  "null",
];
const DEFAULT_ROOT_NAME = "Root";
const IRREGULAR_PLURALS: Record<string, string> = {
  children: "child",
  people: "person",
  men: "man",
  women: "woman",
  mice: "mouse",
  geese: "goose",
  feet: "foot",
  teeth: "tooth",
  indices: "index",
  matrices: "matrix",
  criteria: "criterion",
};

function primitive(name: PrimitiveName): TypeNode {
  return { kind: "primitive", name };
}

function inferArray(values: unknown[]): TypeNode {
  const element = values.map(infer).reduce(merge, NEVER);
  return { kind: "array", element };
}

function inferObject(value: Record<string, unknown>): TypeNode {
  const fields = new Map<string, Field>();
  for (const [key, entry] of Object.entries(value)) {
    fields.set(key, { type: infer(entry), optional: entry === undefined });
  }
  return { kind: "object", fields };
}

function infer(value: unknown): TypeNode {
  if (value === null) return primitive("null");
  if (Array.isArray(value)) return inferArray(value);
  switch (typeof value) {
    case "string":
      return primitive("string");
    case "number":
    case "bigint":
      return primitive("number");
    case "boolean":
      return primitive("boolean");
    case "object":
      return inferObject(value as Record<string, unknown>);
    default:
      return primitive("unknown");
  }
}

function mergeFields(a: Map<string, Field>, b: Map<string, Field>) {
  const fields = new Map<string, Field>();
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const left = a.get(key);
    const right = b.get(key);
    if (left && right) {
      fields.set(key, {
        type: merge(left.type, right.type),
        optional: left.optional || right.optional,
      });
      continue;
    }
    const only = (left ?? right) as Field;
    fields.set(key, { type: only.type, optional: true });
  }
  return fields;
}

function membersOf(node: TypeNode): TypeNode[] {
  return node.kind === "union" ? node.members : [node];
}

function sameKind(a: TypeNode, b: TypeNode) {
  if (a.kind !== b.kind) return false;
  if (a.kind === "primitive" && b.kind === "primitive") {
    return a.name === b.name;
  }
  return true;
}

function mergeSameKind(a: TypeNode, b: TypeNode): TypeNode {
  if (a.kind === "object" && b.kind === "object") {
    return { kind: "object", fields: mergeFields(a.fields, b.fields) };
  }
  if (a.kind === "array" && b.kind === "array") {
    return { kind: "array", element: merge(a.element, b.element) };
  }
  return a;
}

function merge(a: TypeNode, b: TypeNode): TypeNode {
  if (a.kind === "never") return b;
  if (b.kind === "never") return a;
  const members = [...membersOf(a)];
  for (const candidate of membersOf(b)) {
    const index = members.findIndex((member) => sameKind(member, candidate));
    if (index === -1) members.push(candidate);
    else members[index] = mergeSameKind(members[index], candidate);
  }
  return members.length === 1 ? members[0] : { kind: "union", members };
}

function words(text: string) {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

export function toTypeName(text: string, suffix = "") {
  const name = words(text)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join("");
  const base = name || DEFAULT_ROOT_NAME;
  const safe = /^\d/.test(base) ? `Type${base}` : base;
  return safe.endsWith(suffix) ? safe : `${safe}${suffix}`;
}

function singular(word: string) {
  const irregular = IRREGULAR_PLURALS[word.toLowerCase()];
  if (irregular) return irregular;
  if (/ies$/i.test(word)) return word.replace(/ies$/i, "y");
  if (/(ss|x|z|ch|sh|us)es$/i.test(word)) return word.slice(0, -2);
  if (/s$/i.test(word) && !/(ss|us|is)$/i.test(word)) return word.slice(0, -1);
  return `${word}Item`;
}

function itemName(parentName: string) {
  return singular(parentName);
}

function propertyKey(key: string) {
  return IDENTIFIER.test(key) ? key : JSON.stringify(key);
}

function primitiveRank(node: TypeNode) {
  if (node.kind === "primitive") return PRIMITIVE_ORDER.indexOf(node.name);
  if (node.kind === "object") return PRIMITIVE_ORDER.length;
  return PRIMITIVE_ORDER.length + 1;
}

function sortMembers(members: TypeNode[]) {
  const nullLast = (node: TypeNode) =>
    node.kind === "primitive" && node.name === "null" ? 1 : 0;
  return [...members].sort(
    (a, b) => nullLast(a) - nullLast(b) || primitiveRank(a) - primitiveRank(b),
  );
}

class InterfaceWriter {
  private readonly declarations: InterfaceDeclaration[] = [];
  private readonly usedNames = new Set<string>();

  write(node: TypeNode, nameHint: string): string {
    switch (node.kind) {
      case "never":
        return "unknown";
      case "primitive":
        return node.name;
      case "array":
        return this.writeArray(node.element, nameHint);
      case "union":
        return sortMembers(node.members)
          .map((member) => this.write(member, nameHint))
          .join(" | ");
      case "object":
        return this.writeObject(node.fields, nameHint);
    }
  }

  result() {
    return this.declarations;
  }

  private writeArray(element: TypeNode, nameHint: string) {
    const inner = this.write(element, itemName(nameHint));
    return element.kind === "union" ? `(${inner})[]` : `${inner}[]`;
  }

  private writeObject(fields: Map<string, Field>, nameHint: string) {
    if (fields.size === 0) return "Record<string, unknown>";
    const name = this.reserve(toTypeName(nameHint));
    const slot = { name, body: "" };
    this.declarations.push(slot);
    const lines = [...fields].map(([key, field]) => {
      const type = this.write(field.type, key);
      const optional = field.optional ? "?" : "";
      return `  ${propertyKey(key)}${optional}: ${type};`;
    });
    slot.body = lines.join("\n");
    return this.reuseIdentical(slot);
  }

  private reserve(base: string) {
    let name = base;
    for (let n = 2; this.usedNames.has(name); n++) name = `${base}${n}`;
    this.usedNames.add(name);
    return name;
  }

  private reuseIdentical(slot: InterfaceDeclaration) {
    const twin = this.declarations.find(
      (declaration) => declaration !== slot && declaration.body === slot.body,
    );
    if (!twin) return slot.name;
    this.declarations.splice(this.declarations.indexOf(slot), 1);
    this.usedNames.delete(slot.name);
    return twin.name;
  }
}

function render(declaration: InterfaceDeclaration) {
  return `export interface ${declaration.name} {\n${declaration.body}\n}`;
}

export function generateTypescriptInterface(
  value: unknown,
  rootName = DEFAULT_ROOT_NAME,
): string {
  const name = toTypeName(rootName);
  const writer = new InterfaceWriter();
  const node = infer(value);
  const rootType = writer.write(node, name);
  const declarations = writer.result();
  const blocks = declarations.map(render);
  if (rootType !== name) blocks.unshift(`export type ${name} = ${rootType};`);
  return `${blocks.join("\n\n")}\n`;
}
