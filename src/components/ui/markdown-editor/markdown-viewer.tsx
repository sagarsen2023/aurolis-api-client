import MarkdownPreview from "@uiw/react-markdown-preview";
import rehypeSanitize from "rehype-sanitize";
import { cn } from "cn";
import { useColorMode } from "@/hooks/use-color-mode";
import "@uiw/react-markdown-preview/markdown.css";
import "./markdown-editor.css";

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

function MarkdownViewer({ content, className }: Readonly<MarkdownViewerProps>) {
  const colorMode = useColorMode();
  return (
    <div
      className={cn("aurolis-markdown min-w-0", className)}
      data-color-mode={colorMode}
    >
      <MarkdownPreview
        source={content}
        rehypePlugins={[rehypeSanitize]}
        style={{ background: "transparent", padding: 0 }}
      />
    </div>
  );
}

export default MarkdownViewer;
