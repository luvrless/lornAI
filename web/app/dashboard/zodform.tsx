/** @jsxRuntime automatic @jsxImportSource react */
/**
 * Form generator driven by zod schemas. Widget settings use it, so a new
 * widget type gets a working settings form without UI code.
 */
import { useState } from "react";
import type { ZodTypeAny } from "zod";
import { LuPlus, LuTrash2, LuArrowUp, LuArrowDown, LuImage } from "react-icons/lu";
import { Button, ColorField, Select, Toggle, humanize } from "../ui.tsx";
import { useMedia } from "./editor-kit.tsx";
import { MediaPicker } from "./media.tsx";

function unwrap(s: ZodTypeAny): ZodTypeAny {
  let t: any = s;
  while (["ZodDefault", "ZodOptional", "ZodNullable", "ZodEffects"].includes(t._def.typeName)) t = t._def.innerType ?? t._def.schema;
  return t;
}
const typeOf = (s: ZodTypeAny) => (unwrap(s) as any)._def.typeName as string;
const isNullable = (s: any): boolean => s._def.typeName === "ZodNullable" || (s._def.innerType && isNullable(s._def.innerType));

function AssetPick({ value, onChange, label, kinds }: { value: string | null; onChange: (v: string | null) => void; label: string; kinds: string[] }) {
  const media = useMedia();
  const [open, setOpen] = useState(false);
  const a = value ? media[value] : null;
  return (
    <div className="row">
      <div className="thumb">{a?.thumbUrl ? <img src={a.thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <LuImage color="var(--dim)" />}</div>
      <span className="small grow dim">{a ? a.name : "No file"}</span>
      <Button size="sm" onClick={() => setOpen(true)}>{a ? "Change" : "Choose"}</Button>
      {a && <Button size="sm" kind="ghost" onClick={() => onChange(null)} aria-label={`Clear ${label}`}>Clear</Button>}
      {open && <MediaPicker kinds={kinds} onClose={() => setOpen(false)} onPick={(x) => { onChange(x.id); setOpen(false); }} />}
    </div>
  );
}

export function ZodField({ schema, name, value, onChange, parent = "" }: { schema: ZodTypeAny; name: string; value: any; onChange: (v: any) => void; parent?: string }) {
  const t = unwrap(schema) as any;
  const kind = t._def.typeName;
  const label = humanize(name.replace(/AssetId$/, "").replace(/Id$/, " ID"));
  const wrap = (el: React.ReactNode, inline = false) => (
    <div className="ctl" style={inline ? { flexDirection: "row", justifyContent: "space-between", alignItems: "center" } : undefined}>
      <div className="ctl-head"><label>{label}</label></div>{el}
    </div>
  );
  if (name === "assetId" || name.endsWith("AssetId")) return wrap(<AssetPick value={value} onChange={onChange} label={label} kinds={/video/i.test(parent) ? ["video"] : ["image"]} />);
  if (kind === "ZodBoolean") return wrap(<Toggle checked={!!value} onChange={onChange} label={label} />, true);
  if (kind === "ZodEnum") return wrap(<Select value={value} onChange={onChange} options={t._def.values} label={label} />);
  if (kind === "ZodNumber") return wrap(<input className="input" type="number" value={value ?? ""} min={t.minValue ?? undefined} max={t.maxValue ?? undefined} step="any"
    onChange={(e) => onChange(e.target.value === "" ? (isNullable(schema) ? null : 0) : Number(e.target.value))} aria-label={label} />);
  if (kind === "ZodArray") {
    const el = t._def.type;
    const items: any[] = value ?? [];
    const max = t._def.maxLength?.value ?? 50;
    const shape = unwrap(el)._def.typeName === "ZodObject" ? (unwrap(el) as any).shape : null;
    const blank = () => (shape ? Object.fromEntries(Object.entries(shape).map(([k, s]: any) => [k, s.safeParse(undefined).success ? s.parse(undefined) : typeOf(s) === "ZodNumber" ? 0 : typeOf(s) === "ZodBoolean" ? false : ""])) : "");
    return (
      <div className="ctl">
        <div className="ctl-head"><label>{label}</label><span className="small dim">{items.length}/{max}</span></div>
        {items.map((it, i) => (
          <div key={i} className="inset" style={{ padding: 10 }}>
            <div className="spread" style={{ marginBottom: 8 }}>
              <span className="small dim">Item {i + 1}</span>
              <div className="row" style={{ gap: 2 }}>
                <Button size="sm" kind="ghost" icon disabled={i === 0} onClick={() => { const n = [...items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); }} aria-label="Move up"><LuArrowUp /></Button>
                <Button size="sm" kind="ghost" icon disabled={i === items.length - 1} onClick={() => { const n = [...items]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; onChange(n); }} aria-label="Move down"><LuArrowDown /></Button>
                <Button size="sm" kind="ghost" icon onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove item"><LuTrash2 /></Button>
              </div>
            </div>
            {shape ? <div className="col">{Object.entries(shape).map(([k, s]: any) => <ZodField key={k} parent={name} schema={s} name={k} value={it[k]} onChange={(v) => onChange(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)))} />)}</div>
              : <ZodField schema={el} name="value" value={it} onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} />}
          </div>
        ))}
        {items.length < max && <Button size="sm" onClick={() => onChange([...items, blank()])}><LuPlus />Add</Button>}
      </div>
    );
  }
  if (kind === "ZodObject") return <div className="col">{Object.entries(t.shape).map(([k, s]: any) => <ZodField key={k} schema={s} name={k} value={value?.[k]} onChange={(v) => onChange({ ...value, [k]: v })} />)}</div>;
  // strings (incl. unions of url | "")
  const str = String(value ?? "");
  const checks: any[] = (kind === "ZodString" ? t._def.checks : []) ?? [];
  const isDateTime = checks.some((c) => c.kind === "datetime");
  const isDate = checks.some((c) => c.kind === "regex" && String(c.regex) === String(/^\d{4}-\d{2}-\d{2}$/));
  const isColor = /color/i.test(name) && /^#/.test(str);
  if (isColor) return wrap(<ColorField value={str} onChange={onChange} label={label} />);
  if (isDateTime) {
    const local = value ? new Date(new Date(value).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
    return wrap(<input className="input" type="datetime-local" value={local} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} aria-label={label} />);
  }
  if (isDate) return wrap(<input className="input" type="date" value={str} onChange={(e) => onChange(e.target.value)} aria-label={label} />);
  const max = checks.find((c) => c.kind === "max")?.value ?? 2000;
  const long = max > 300 || name === "text";
  return wrap(long ? <textarea className="textarea" value={str} maxLength={max} onChange={(e) => onChange(e.target.value)} aria-label={label} /> : <input className="input" value={str} maxLength={max} onChange={(e) => onChange(e.target.value)} aria-label={label} />);
}
