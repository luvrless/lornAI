/** @jsxRuntime automatic @jsxImportSource react */
import { useState } from "react";
import { LuImage, LuSquare, LuType, LuMousePointer2, LuSparkles, LuWand, LuDoorOpen, LuAward, LuLink } from "react-icons/lu";
import { BG_EFFECTS, OVERLAY_EFFECTS, TEXT_EFFECTS, ENTRANCE_ANIMS, HOVER_EFFECTS, ENTRY_TRANSITIONS, FONTS, CARD_LAYOUTS, CURSOR_TYPES, CURSOR_TRAILS } from "../../../shared/profile-schema.ts";
import { EditorLayout, Section, NumCtl, ColorCtl, SelectCtl, SegCtl, BoolCtl, TextCtl, AssetCtl, useVal } from "./editor-kit.tsx";
import { setPath } from "../editor-store.ts";
import { Button, ColorField } from "../ui.tsx";
import { useEditor } from "../editor-store.ts";

function EffectColors() {
  const colors = useVal<string[]>("background.effectColors");
  return (
    <div className="ctl">
      <div className="ctl-head"><label>Effect colours</label></div>
      {colors.map((c, i) => (
        <div key={i} className="row">
          <div className="grow"><ColorField value={c} label={`Colour ${i + 1}`} onChange={(v) => setPath("background.effectColors", colors.map((x, j) => (j === i ? v : x)))} /></div>
          {colors.length > 1 && <Button size="sm" kind="ghost" onClick={() => setPath("background.effectColors", colors.filter((_, j) => j !== i))} aria-label={`Remove colour ${i + 1}`}>Remove</Button>}
        </div>
      ))}
      {colors.length < 4 && <Button size="sm" onClick={() => setPath("background.effectColors", [...colors, "#38bdf8"])}>Add colour</Button>}
    </div>
  );
}

function AnimBlock({ which, label }: { which: string; label: string }) {
  const p = `animations.${which}`;
  const type = useVal<string>(`${p}.type`);
  return (
    <div className="inset" style={{ padding: 12 }}>
      <div className="col" style={{ gap: 10 }}>
        <SelectCtl path={`${p}.type`} label={label} options={ENTRANCE_ANIMS} />
        {type !== "none" && <>
          <NumCtl path={`${p}.durationMs`} label="Duration (ms)" min={100} max={5000} step={50} />
          <NumCtl path={`${p}.delayMs`} label="Delay (ms)" min={0} max={5000} step={50} />
          {["links", "badges", "widgets"].includes(which) && <NumCtl path={`${p}.stagger`} label="Stagger between items (ms)" min={0} max={1000} step={10} />}
          <NumCtl path={`${p}.intensity`} label="Intensity" min={0} max={100} />
        </>}
      </div>
    </div>
  );
}

export function Customize() {
  const [open, setOpen] = useState<string>("background");
  const toggle = (id: string) => setOpen((o) => (o === id ? "" : id));
  const bgType = useEditor((s) => s.config.background.type);
  const entry = useEditor((s) => s.config.entry);
  const cursorType = useEditor((s) => s.config.cursor.type);
  const borderGrad = useEditor((s) => s.config.card.borderGradient);
  const tilt = useEditor((s) => s.config.card.tilt3d);
  const nameGrad = useEditor((s) => s.config.typography.nameGradient);
  const overlay = useEditor((s) => s.config.effects.overlay);
  return (
    <EditorLayout entry={open === "entry" ? "show" : "skip"}>
      <Section id="background" open={open === "background"} onToggle={toggle} icon={<LuImage />} title="Background">
        <SegCtl path="background.type" label="Type" options={["effect", "video", "image", "gradient", "color"]} />
        {bgType === "effect" && <><SelectCtl path="background.effect" label="Effect" options={BG_EFFECTS} /><EffectColors />
          <NumCtl path="background.speed" label="Animation speed" min={0.1} max={4} step={0.1} /><NumCtl path="background.intensity" label="Intensity" min={0} max={100} /><NumCtl path="background.density" label="Density" min={0} max={100} /></>}
        {bgType === "video" && <><AssetCtl path="background.assetId" label="Video" kinds={["video"]} hint="MP4, WebM or MOV — free on every plan" /><BoolCtl path="background.videoLoop" label="Loop video" /><NumCtl path="background.playbackRate" label="Playback speed" min={0.25} max={2} step={0.05} /></>}
        {bgType === "image" && <AssetCtl path="background.assetId" label="Image" kinds={["image"]} hint="PNG, JPG, WebP or GIF" />}
        {(bgType === "image" || bgType === "video") && <><NumCtl path="background.posX" label="Horizontal position" min={0} max={100} unit="%" /><NumCtl path="background.posY" label="Vertical position" min={0} max={100} unit="%" /><NumCtl path="background.scale" label="Zoom" min={1} max={3} step={0.05} /></>}
        {bgType === "gradient" && <><ColorCtl path="background.gradientFrom" label="From" /><ColorCtl path="background.gradientTo" label="To" /><NumCtl path="background.gradientAngle" label="Angle" min={0} max={360} unit="°" /><BoolCtl path="background.gradientAnimated" label="Animate gradient" /></>}
        {bgType === "color" && <ColorCtl path="background.color" label="Colour" />}
        <NumCtl path="background.opacity" label="Opacity" min={0} max={100} unit="%" />
        <NumCtl path="background.brightness" label="Brightness" min={0} max={200} unit="%" />
        <NumCtl path="background.contrast" label="Contrast" min={0} max={200} unit="%" />
        <NumCtl path="background.saturation" label="Saturation" min={0} max={200} unit="%" />
        <NumCtl path="background.blur" label="Blur" min={0} max={40} unit="px" />
        <ColorCtl path="background.overlayColor" label="Overlay colour" /><NumCtl path="background.overlayOpacity" label="Overlay opacity" min={0} max={100} unit="%" />
      </Section>

      <Section id="card" open={open === "card"} onToggle={toggle} icon={<LuSquare />} title="Profile card">
        <SegCtl path="card.layout" label="Layout" options={CARD_LAYOUTS} />
        <NumCtl path="card.width" label="Width" min={320} max={900} unit="px" />
        <NumCtl path="card.minHeight" label="Minimum height" min={0} max={1200} unit="px" />
        <SegCtl path="card.align" label="Horizontal position" options={["left", "center", "right"]} />
        <SegCtl path="card.verticalAlign" label="Vertical position" options={["top", "center", "bottom"]} />
        <NumCtl path="card.padding" label="Padding" min={8} max={64} unit="px" />
        <NumCtl path="card.radius" label="Corner radius" min={0} max={48} unit="px" />
        <ColorCtl path="card.bgColor" label="Card colour" /><NumCtl path="card.bgOpacity" label="Card opacity" min={0} max={100} unit="%" />
        <NumCtl path="card.blur" label="Background blur" min={0} max={40} unit="px" />
        <NumCtl path="card.borderWidth" label="Border width" min={0} max={6} unit="px" />
        <BoolCtl path="card.borderGradient" label="Gradient border" />
        {borderGrad ? <><ColorCtl path="card.borderFrom" label="Border from" /><ColorCtl path="card.borderTo" label="Border to" /></> : <ColorCtl path="card.borderColor" label="Border colour" alpha />}
        <NumCtl path="card.shadow" label="Shadow" min={0} max={100} />
        <ColorCtl path="card.glowColor" label="Glow colour" /><NumCtl path="card.glow" label="Glow" min={0} max={100} />
        <SelectCtl path="card.hover" label="Hover effect" options={HOVER_EFFECTS.filter((h) => h !== "tilt" && h !== "shine")} />
        <BoolCtl path="card.tilt3d" label="3D tilt" hint="The card leans toward the pointer" />
        {tilt && <NumCtl path="card.tiltMax" label="Maximum tilt" min={0} max={25} unit="°" />}
        <BoolCtl path="card.mouseGlow" label="Glow follows the pointer" />
      </Section>

      <Section id="type" open={open === "type"} onToggle={toggle} icon={<LuType />} title="Typography">
        <SelectCtl path="typography.font" label="Font" options={FONTS} />
        <AssetCtl path="typography.customFontAssetId" label="Custom font (Premium)" kinds={["font"]} hint="WOFF2, WOFF, TTF or OTF" />
        <NumCtl path="typography.weight" label="Body weight" min={100} max={900} step={100} />
        <NumCtl path="typography.headingWeight" label="Name weight" min={100} max={900} step={100} />
        <NumCtl path="typography.size" label="Body size" min={12} max={22} step={0.5} unit="px" />
        <NumCtl path="typography.nameSize" label="Name size" min={16} max={64} unit="px" />
        <NumCtl path="typography.letterSpacing" label="Letter spacing" min={-2} max={10} step={0.5} />
        <NumCtl path="typography.lineHeight" label="Line height" min={1} max={2.4} step={0.05} />
        <SegCtl path="typography.align" label="Alignment" options={["left", "center", "right"]} />
        <ColorCtl path="typography.color" label="Text colour" /><ColorCtl path="typography.mutedColor" label="Secondary text" /><ColorCtl path="typography.accentColor" label="Accent" />
        <BoolCtl path="typography.nameGradient" label="Gradient name" />
        {nameGrad && <><ColorCtl path="typography.gradientFrom" label="Gradient from" /><ColorCtl path="typography.gradientTo" label="Gradient to" /></>}
        <NumCtl path="typography.shadow" label="Text shadow" min={0} max={100} />
        <NumCtl path="typography.glow" label="Text glow" min={0} max={100} /><ColorCtl path="typography.glowColor" label="Glow colour" />
        <SelectCtl path="typography.nameEffect" label="Name effect" options={TEXT_EFFECTS} />
        <SelectCtl path="typography.bioEffect" label="Bio effect" options={TEXT_EFFECTS} />
        <NumCtl path="typography.effectSpeed" label="Effect speed" min={0.25} max={4} step={0.25} />
        <BoolCtl path="typography.effectLoop" label="Loop text effects" hint="Applies to typewriter and decrypt" />
      </Section>

      <Section id="cursor" open={open === "cursor"} onToggle={toggle} icon={<LuMousePointer2 />} title="Cursor">
        <SelectCtl path="cursor.type" label="Cursor" options={CURSOR_TYPES} />
        {cursorType === "custom" && <AssetCtl path="cursor.assetId" label="Cursor image (Premium)" kinds={["cursor"]} hint="PNG, WebP or GIF up to 256×256" />}
        {cursorType !== "default" && cursorType !== "none" && <><NumCtl path="cursor.size" label="Size" min={8} max={64} unit="px" /><NumCtl path="cursor.hoverScale" label="Size over links" min={1} max={3} step={0.1} /></>}
        <ColorCtl path="cursor.color" label="Colour" />
        <SelectCtl path="cursor.trail" label="Trail" options={CURSOR_TRAILS} />
        <NumCtl path="cursor.trailLength" label="Trail length" min={4} max={40} />
        <NumCtl path="cursor.glow" label="Glow" min={0} max={100} />
        <p className="small dim">Touch devices always use the normal cursor.</p>
      </Section>

      <Section id="effects" open={open === "effects"} onToggle={toggle} icon={<LuSparkles />} title="Visual effects">
        <SelectCtl path="effects.overlay" label="Overlay" options={OVERLAY_EFFECTS} />
        {overlay !== "none" && <><ColorCtl path="effects.color" label="Colour" /><NumCtl path="effects.density" label="Density" min={0} max={100} /><NumCtl path="effects.speed" label="Speed" min={0.1} max={4} step={0.1} /><NumCtl path="effects.size" label="Particle size" min={0.5} max={4} step={0.1} /></>}
        <BoolCtl path="effects.ambientLight" label="Ambient light" hint="A soft glow behind your card in the glow colour" />
      </Section>

      <Section id="anim" open={open === "anim"} onToggle={toggle} icon={<LuWand />} title="Animations">
        <p className="small dim">Use “Replay animations” above the preview to see them again. Visitors who prefer reduced motion see no entrance animations.</p>
        <AnimBlock which="profile" label="Profile card entrance" />
        <AnimBlock which="avatar" label="Avatar" />
        <AnimBlock which="name" label="Name" />
        <AnimBlock which="bio" label="Bio" />
        <AnimBlock which="links" label="Links" />
        <AnimBlock which="badges" label="Badges" />
        <AnimBlock which="widgets" label="Widgets" />
      </Section>

      <Section id="entry" open={open === "entry"} onToggle={toggle} icon={<LuDoorOpen />} title="Click to enter">
        <BoolCtl path="entry.enabled" label="Show an entry screen" hint="Visitors click to reveal your profile. Needed for music to start automatically." />
        <TextCtl path="entry.title" label="Title" max={60} />
        <BoolCtl path="entry.typewriter" label="Type the title out" />
        {entry.typewriter && <NumCtl path="entry.typewriterPauseMs" label="Pause before retyping (ms)" min={0} max={10000} step={100} />}
        <TextCtl path="entry.subtitle" label="Subtitle" max={80} />
        <TextCtl path="entry.description" label="Description" max={200} area />
        <TextCtl path="entry.buttonText" label="Button text" max={30} />
        <SelectCtl path="entry.buttonIcon" label="Button icon" options={["none", "arrow", "play", "sparkles", "door", "power"]} />
        <SegCtl path="entry.buttonStyle" label="Button style" options={["glass", "solid", "outline", "text"]} />
        <SelectCtl path="entry.bgType" label="Background" options={["blur", "color", "gradient", "image", "video", "effect"]} />
        {entry.bgType === "color" && <ColorCtl path="entry.color" label="Colour" />}
        {entry.bgType === "blur" && <ColorCtl path="entry.color" label="Tint" />}
        {entry.bgType === "gradient" && <><ColorCtl path="entry.gradientFrom" label="From" /><ColorCtl path="entry.gradientTo" label="To" /></>}
        {(entry.bgType === "image" || entry.bgType === "video") && <AssetCtl path="entry.assetId" label={entry.bgType === "video" ? "Video" : "Image"} kinds={[entry.bgType]} />}
        {entry.bgType === "effect" && <SelectCtl path="entry.effect" label="Effect" options={BG_EFFECTS} />}
        <NumCtl path="entry.blur" label="Blur" min={0} max={40} unit="px" />
        <SelectCtl path="entry.font" label="Font" options={FONTS} /><ColorCtl path="entry.textColor" label="Text colour" />
        <AssetCtl path="entry.soundAssetId" label="Click sound" kinds={["audio"]} />
        <NumCtl path="entry.volume" label="Sound volume" min={0} max={100} unit="%" />
        <SelectCtl path="entry.enterAnim" label="Entrance animation" options={ENTRANCE_ANIMS} />
        <SelectCtl path="entry.exit" label="Exit transition" options={ENTRY_TRANSITIONS} />
        <NumCtl path="entry.exitMs" label="Exit duration (ms)" min={200} max={3000} step={50} />
        <p className="small dim">While this section is open the preview shows the entry screen. Click it to try the exit transition.</p>
      </Section>

      <Section id="linkstyle" open={open === "linkstyle"} onToggle={toggle} icon={<LuLink />} title="Link style">
        <SegCtl path="linksStyle.layout" label="Layout" options={["icons", "buttons", "grid"]} />
        <NumCtl path="linksStyle.iconSize" label="Icon size" min={16} max={48} unit="px" />
        <BoolCtl path="linksStyle.useBrandColors" label="Use brand colours" />
        <ColorCtl path="linksStyle.iconColor" label="Icon colour" />
        <ColorCtl path="linksStyle.buttonColor" label="Button colour" /><NumCtl path="linksStyle.buttonOpacity" label="Button opacity" min={0} max={100} unit="%" />
      </Section>

      <Section id="badgestyle" open={open === "badgestyle"} onToggle={toggle} icon={<LuAward />} title="Badge display">
        <BoolCtl path="badgesStyle.show" label="Show badges" />
        <NumCtl path="badgesStyle.size" label="Badge size" min={14} max={40} unit="px" />
        <BoolCtl path="badgesStyle.background" label="Badge background" />
        <SegCtl path="badgesStyle.position" label="Position" options={["name", "below"]} />
        <p className="small dim">Reorder or hide individual badges on the Badges page.</p>
      </Section>
    </EditorLayout>
  );
}
