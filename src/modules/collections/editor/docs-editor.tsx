import { MarkdownField } from "@/components/markdown-field";

function DocsEditor({
  value,
  onChange,
  subject,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  subject: string;
}>) {
  return (
    <MarkdownField
      key={subject}
      value={value}
      onChange={onChange}
      minHeight={320}
      placeholder={`Describe this ${subject} in markdown: what it does, required headers, example payloads…`}
      emptyPreview={`No description yet. Switch to Write to document this ${subject}.`}
    />
  );
}

export default DocsEditor;
