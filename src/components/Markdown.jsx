import { memo, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import hljs from "highlight.js/lib/common";
import { normalizeLang, langLabel, langColor, canPreview, previewLabel, fileNameFor } from "../lib/preview.js";
import { IconCheck, IconCopy, IconDownload, IconPlay, IconCode } from "./Icons.jsx";

const HLJS_NAME = { jsx: "javascript", tsx: "typescript", svg: "xml", html: "xml", vue: "xml", mermaid: "plaintext", dockerfile: "bash", powershell: "bash", latex: "plaintext", toml: "ini", luau: "lua" };

export function highlight(code, lang) {
  const name = HLJS_NAME[lang] || lang;
  try {
    if (name && hljs.getLanguage(name)) return hljs.highlight(code, { language: name, ignoreIllegals: true }).value;
    return hljs.highlightAuto(code).value;
  } catch {
    return code.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  }
}

export function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = Object.assign(document.createElement("textarea"), { value: text });
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return [copied, copy];
}

const CodeBlock = memo(function CodeBlock({ rawLang, code, onOpen, streaming }) {
  const lang = normalizeLang(rawLang, code);
  const html = useMemo(() => highlight(code, lang), [code, lang]);
  const [copied, copy] = useCopy();
  const lines = code ? code.split("\n").length : 0;
  const previewable = canPreview(lang);

  return (
    <div className={`codeblock ${streaming ? "is-streaming" : ""}`}>
      <div className="code-head">
        <span className="code-lang">
          <span className="lang-dot" style={{ background: langColor(lang) }} />
          {langLabel(lang)}
          <span className="code-lines">{lines} lines</span>
        </span>
        <div className="code-actions">
          {onOpen && (
            <button className="code-btn accent" onClick={() => onOpen(code, lang)} title={previewable ? `Run · ${previewLabel(lang)}` : "Open in code panel"}>
              {previewable ? <IconPlay size={13} /> : <IconCode size={14} />}
              <span>{previewable ? "Run" : "Open"}</span>
            </button>
          )}
          <button className="code-btn" onClick={() => download(fileNameFor(lang), code)} title="Download">
            <IconDownload size={14} />
          </button>
          <button className="code-btn" onClick={() => copy(code)} title="Copy code">
            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>
      <pre className="code-body">
        <code className={`hljs language-${lang}`} dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
});

function Markdown({ text, onOpenCode, streaming }) {
  const components = useMemo(
    () => ({
      pre: ({ children }) => <>{children}</>,
      code({ className, children, node, ...rest }) {
        const raw = String(children ?? "");
        const m = /language-([^\s]+)/.exec(className || "");
        const isBlock = m || raw.includes("\n") || node?.position?.start.line !== node?.position?.end.line;
        if (!isBlock) return <code className="inline-code" {...rest}>{children}</code>;
        return <CodeBlock rawLang={m?.[1] || ""} code={raw.replace(/\n$/, "")} onOpen={onOpenCode} streaming={streaming} />;
      },
      a: ({ children, href }) => (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {children}
        </a>
      ),
      table: ({ children }) => (
        <div className="table-wrap">
          <table>{children}</table>
        </div>
      ),
    }),
    [onOpenCode, streaming]
  );
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </ReactMarkdown>
  );
}

export default memo(Markdown);
