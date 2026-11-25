import type { HeaderPair } from "@/types/engine/engine.type";

function HeadersTable({
  headers,
  label,
}: Readonly<{ headers: HeaderPair[]; label: string }>) {
  if (headers.length === 0) {
    return <p className="text-[13px] text-mute">No headers.</p>;
  }
  return (
    <table aria-label={label} className="w-full border-collapse text-[12.5px]">
      <thead>
        <tr className="border-b border-line text-left text-[11.5px] text-dim">
          <th scope="col" className="w-1/3 py-1.5 pr-3 font-medium">
            Name
          </th>
          <th scope="col" className="py-1.5 font-medium">
            Value
          </th>
        </tr>
      </thead>
      <tbody>
        {headers.map(([name, value], index) => (
          <tr
            key={`${name}-${index}`}
            className="border-b border-line/60 align-top"
          >
            <td className="py-1.5 pr-3 font-mono text-foreground">{name}</td>
            <td className="py-1.5 font-mono break-all text-mute">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default HeadersTable;
