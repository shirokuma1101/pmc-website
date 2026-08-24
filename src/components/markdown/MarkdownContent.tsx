import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

export interface MarkdownContentProps {
  children: string;
}

const markdownHtmlSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      ["className", "image-gallery"],
    ],
  },
};

/** Renders Markdown and a safe subset of embedded HTML. */
export function MarkdownContent({ children }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownHtmlSchema]]}
    >
      {children}
    </ReactMarkdown>
  );
}
