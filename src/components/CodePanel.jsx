import { useEffect, useMemo, useRef, useState } from "react";
import { buildPreview, canPreview, langColor, langLabel, previewLabel, fileNameFor } from "../lib/preview.js";
import { highlight, download, useCopy } from "./Markdown.jsx";
import { IconCheck, IconCode, IconCopy, IconDownload, IconExternal, IconEye, IconRefresh, IconTerminal, IconX, IconMaximize } from "./Icons.jsx";

/**
 * Right-hand "canvas" panel. Shows the selected code block of a message, live while it streams,
 * and auto-matches the preview runtime to the block's language.
 */
export default function CodePanel({ blocks, index, onIndex, streaming, onClose, expanded, onExpand }) {
  const block = blocks[index] || blocks[blocks.length - 1];
  const lang = block?.lang || "plaintext";
  const previewable = canPreview(lang);
  const ready = block && (block.closed || !streaming);
  const [tab, setTab] = useState(previewable ? "preview" : "code");
  const [runKey, setRunKey] = useState(0);
  const [logs, setLogs] = useState([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [copied, copy] = useCopy();
  const frame = useRef(null);
  const codeRef = useRef(null);

  // Auto-match: code tab while it is being written, preview once complete.
  useEffect(() => {
    setTab(previewable && ready ? "preview" : "code");
  }, [previewable, ready, index, lang]);

  useEffect(() => {
    if (!ready || tab !== "code") codeRef.current?.scrollTo({ top: codeRef.current.scrollHeight });
  }, [block?.code, ready, tab]);

  const srcDoc = useMemo(() => (ready && previewable ? buildPreview(block, blocks.filter((b) => b !== block)) : null), [ready, previewable, block?.code, lang, runKey]); // eslint-disable-line

  useEffect(() => setLogs([]), [srcDoc]);
  useEffect(() => {
    const onMsg = (e) => {
      if (!e.data?.__flair || e.source !== frame.current?.contentWindow) return;
      setLogs((l) => [...l.slice(-199), { level: e.data.level, text: e.data.args.join(" ") }]);
      if (e.data.level === "error") setConsoleOpen(true);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const html = useMemo(() => (block ? highlight(block.code, lang) : ""), [block?.code, lang]); // eslint-disable-line

  if (!block) return null;

  const openInTab = () => {
    const url = URL.createObjectURL(new Blob([srcDoc], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const showsOwnConsole = ["javascript", "typescript", "python", "lua"].includes(lang);

  return (
    <section className={`code-panel ${expanded ? "expanded" : ""}`}>
      <header className="cp-head">
        <div className="cp-title">
          <span className="lang-dot" style={{ background: langColor(lang) }} />
          <span className="cp-file">{fileNameFor(lang, index)}</span>
          <span className="cp-runtime">{previewable ? previewLabel(lang) : `${langLabel(lang)} · view only`}</span>
          {!ready && <span className="cp-live"><i /> writing</span>}
        </div>
        <div className="cp-actions">
          {previewable && (
            <div className="seg">
              <button className={tab === "preview" ? "on" : ""} onClick={() => setTab("preview")} disabled={!ready}>
                <IconEye size={14} /> Preview
              </button>
              <button className={tab === "code" ? "on" : ""} onClick={() => setTab("code")}>
                <IconCode size={14} /> Code
              </button>
            </div>
          )}
          {previewable && tab === "preview" && (
            <>
              <button className="icon-btn" title="Re-run" onClick={() => setRunKey((k) => k + 1)}>
                <IconRefresh size={16} />
              </button>
              <button className="icon-btn" title="Open in new tab" onClick={openInTab} disabled={!srcDoc}>
                <IconExternal size={16} />
              </button>
            </>
          )}
          <button className="icon-btn" title="Copy" onClick={() => copy(block.code)}>
            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          </button>
          <button className="icon-btn" title="Download" onClick={() => download(fileNameFor(lang, index), block.code)}>
            <IconDownload size={16} />
          </button>
          <button className="icon-btn hide-mobile" title={expanded ? "Restore" : "Expand"} onClick={onExpand}>
            <IconMaximize size={16} />
          </button>
          <button className="icon-btn" title="Close" onClick={onClose}>
            <IconX size={17} />
          </button>
        </div>
      </header>

      {blocks.length > 1 && (
        <div className="cp-files">
          {blocks.map((b, i) => (
            <button key={i} className={`cp-file-tab ${i === index ? "on" : ""}`} onClick={() => onIndex(i)}>
              <span className="lang-dot" style={{ background: langColor(b.lang) }} />
              {fileNameFor(b.lang, i)}
            </button>
          ))}
        </div>
      )}

      <div className="cp-body">
        <div className={`cp-view ${tab === "code" ? "show" : ""}`} ref={codeRef}>
          <pre className="cp-code">
            <code className={`hljs ${!ready ? "typing-code" : ""}`} dangerouslySetInnerHTML={{ __html: html }} />
          </pre>
        </div>
        {previewable && (
          <div className={`cp-view preview ${tab === "preview" ? "show" : ""}`}>
            {srcDoc ? (
              <iframe
                key={runKey + srcDoc.length}
                ref={frame}
                title="Preview"
                className="cp-frame"
                sandbox="allow-scripts allow-modals allow-forms allow-popups allow-downloads allow-pointer-lock"
                srcDoc={srcDoc}
              />
            ) : (
              <div className="cp-wait">
                <div className="loader-ring" />
                Waiting for the code to finish…
              </div>
            )}
          </div>
        )}
      </div>

      {previewable && tab === "preview" && !showsOwnConsole && (
        <div className={`cp-console ${consoleOpen ? "open" : ""}`}>
          <button className="cp-console-bar" onClick={() => setConsoleOpen((o) => !o)}>
            <IconTerminal size={14} /> Console
            {logs.length > 0 && <span className={`count ${logs.some((l) => l.level === "error") ? "err" : ""}`}>{logs.length}</span>}
            {logs.length > 0 && (
              <span className="clear" onClick={(e) => (e.stopPropagation(), setLogs([]))}>
                clear
              </span>
            )}
          </button>
          {consoleOpen && (
            <div className="cp-logs">
              {logs.length === 0 && <div className="log sys">No console output.</div>}
              {logs.map((l, i) => (
                <div key={i} className={`log ${l.level}`}>
                  {l.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
