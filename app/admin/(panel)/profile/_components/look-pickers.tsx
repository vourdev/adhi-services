import { cn } from "cn";
import { Check, Pipette } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { type CSSProperties, type ReactNode, useState } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { normalizeHex, readableOn } from "@/lib/color";
import {
  ACCENTS,
  CARD_SHAPES,
  CARD_STYLES,
  FONTS,
  type Accent,
  type CardShape,
  type CardStyle,
  type FontOption,
  type ThemePreset,
} from "@/lib/domain";
import {
  CARD_SHAPE_LABELS,
  CARD_STYLE_LABELS,
  fontStack,
  isNamedAccent,
  NAMED_ACCENT_HEX,
  type NamedPreset,
  PRESET_ORDER,
  PRESETS,
  type ProfileLook,
  surfaceAttributes,
} from "@/lib/profile-look";

/**
 * Pickers for the profile's look. Each is a radio group of tiles that show
 * the option itself, drawn with the same .profile-surface styles as the
 * public page. Client-only: imported by the profile editor.
 */

function TileGroup<T extends string>({
  label,
  value,
  onChange,
  disabled,
  className,
  children,
}: {
  label: string;
  value: T | "";
  onChange: (value: T) => void;
  disabled?: boolean | undefined;
  className?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <RadioGroupPrimitive.Root
      aria-label={label}
      value={value}
      onValueChange={(next) => onChange(next as T)}
      disabled={disabled}
      className={cn("grid gap-2", className)}
    >
      {children}
    </RadioGroupPrimitive.Root>
  );
}

function Tile({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <RadioGroupPrimitive.Item
      value={value}
      className={cn(
        "group/tile relative flex min-w-0 flex-col gap-1.5 rounded-lg border bg-card p-1.5 text-left text-sm transition-[border-color,box-shadow] duration-150 outline-none",
        "hover:border-foreground/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "data-[state=checked]:border-primary data-[state=checked]:ring-1 data-[state=checked]:ring-primary",
        "disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-border",
        className
      )}
    >
      {children}
      <span
        aria-hidden
        className="absolute top-1 right-1 hidden size-4 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm group-data-[state=checked]/tile:grid"
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
    </RadioGroupPrimitive.Item>
  );
}

/** A small, non-interactive profile sample in a given look. */
function MiniProfile({
  look,
  className,
  children,
}: {
  look: ProfileLook;
  className?: string;
  children: ReactNode;
}): ReactNode {
  const { style, ...attributes } = surfaceAttributes(look);
  return (
    <div
      aria-hidden
      {...attributes}
      style={{ ...style, "--p-shape-scale": "0.45" } as CSSProperties}
      className={cn(
        "profile-surface pointer-events-none flex flex-col gap-1.5 overflow-hidden rounded-md p-2.5",
        className
      )}
    >
      {children}
    </div>
  );
}

function MiniRow(): ReactNode {
  return (
    <span className="p-card p-row flex h-5 shrink-0 items-center gap-1.5 px-1.5">
      <span className="size-2.5 shrink-0 rounded-[var(--p-r-media)] bg-p-accent-soft" />
      <span className="h-1 w-8 rounded-full bg-p-fg/45" />
    </span>
  );
}

export function PresetPicker({
  value,
  theme,
  onChange,
  disabled,
}: {
  value: ThemePreset;
  /** The profile's light/dark setting, for the presets that follow it. */
  theme: ProfileLook["theme"];
  onChange: (preset: NamedPreset) => void;
  disabled?: boolean;
}): ReactNode {
  return (
    <TileGroup
      label="Preset tema"
      value={value === "custom" ? "" : value}
      onChange={onChange}
      disabled={disabled}
      className="grid-cols-2 sm:grid-cols-3 2xl:grid-cols-5"
    >
      {PRESET_ORDER.map((preset) => {
        const definition = PRESETS[preset];
        return (
          <Tile key={preset} value={preset}>
            <MiniProfile
              className="h-[5.5rem]"
              look={{
                theme,
                preset,
                accent: definition.accent,
                font: definition.font,
                cardShape: definition.cardShape,
                cardStyle: definition.cardStyle,
                customTheme: null,
              }}
            >
              <span className="flex items-center gap-1.5">
                <span className="size-4 shrink-0 rounded-full bg-p-accent" />
                <span className="p-name text-xs leading-none font-bold">
                  Aa
                </span>
              </span>
              <MiniRow />
              <MiniRow />
            </MiniProfile>
            <span className="px-1 leading-tight font-medium">
              {definition.label}
            </span>
            <span className="px-1 pb-0.5 text-xs text-muted-foreground">
              {definition.description}
            </span>
          </Tile>
        );
      })}
    </TileGroup>
  );
}

export function FontPicker({
  value,
  onChange,
  disabled,
}: {
  value: FontOption;
  onChange: (font: FontOption) => void;
  disabled?: boolean;
}): ReactNode {
  return (
    <TileGroup
      label="Font"
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="grid-cols-2 sm:grid-cols-3"
    >
      {FONTS.map((font) => (
        <Tile key={font} value={font} className="px-2.5 py-2">
          <span
            className="text-[1.625rem] leading-none font-semibold"
            style={{ fontFamily: fontStack(font) }}
          >
            Aa
          </span>
          <span className="truncate text-xs text-muted-foreground">{font}</span>
        </Tile>
      ))}
    </TileGroup>
  );
}

/** Corner radius of the little shape glyph, roughly what each shape does to a card. */
const SHAPE_GLYPH: Record<CardShape, string> = {
  sharp: "0px",
  rounded: "4px",
  smooth: "7px",
  extra: "10px",
  pill: "999px",
};

export function ShapePicker({
  value,
  onChange,
  disabled,
}: {
  value: CardShape;
  onChange: (shape: CardShape) => void;
  disabled?: boolean;
}): ReactNode {
  return (
    <TileGroup
      label="Bentuk sudut kartu"
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="grid-cols-5"
    >
      {CARD_SHAPES.map((shape) => (
        <Tile
          key={shape}
          value={shape}
          className="items-center gap-2 pt-3 pb-2"
        >
          <span
            className="h-6 w-9 border-2 border-foreground/70"
            style={{ borderRadius: SHAPE_GLYPH[shape] }}
          />
          <span className="text-xs">{CARD_SHAPE_LABELS[shape]}</span>
        </Tile>
      ))}
    </TileGroup>
  );
}

export function StylePicker({
  value,
  look,
  onChange,
  disabled,
}: {
  value: CardStyle;
  /** The current look; each tile shows it with that card style. */
  look: ProfileLook;
  onChange: (style: CardStyle) => void;
  disabled?: boolean;
}): ReactNode {
  return (
    <TileGroup
      label="Gaya kartu"
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="grid-cols-3 sm:grid-cols-6"
    >
      {CARD_STYLES.map((style) => (
        <Tile key={style} value={style}>
          <MiniProfile
            look={{ ...look, cardStyle: style }}
            className="h-12 justify-center"
          >
            <MiniRow />
          </MiniProfile>
          <span className="truncate px-1 pb-0.5 text-xs">
            {CARD_STYLE_LABELS[style]}
          </span>
        </Tile>
      ))}
    </TileGroup>
  );
}

const ACCENT_SWATCHES: Record<Accent, { label: string; color: string }> = {
  blue: { label: "Biru", color: NAMED_ACCENT_HEX.blue },
  emerald: { label: "Hijau", color: NAMED_ACCENT_HEX.emerald },
  rose: { label: "Merah", color: NAMED_ACCENT_HEX.rose },
  amber: { label: "Oranye", color: NAMED_ACCENT_HEX.amber },
  violet: { label: "Ungu", color: NAMED_ACCENT_HEX.violet },
  slate: { label: "Hitam", color: NAMED_ACCENT_HEX.slate },
};

const RAINBOW =
  "conic-gradient(from 90deg, #ef4444, #f59e0b, #22c55e, #06b6d4, #3b82f6, #a855f7, #ec4899, #ef4444)";

/**
 * Six ready accents, plus any colour from the system colour picker or typed
 * as hex. Every change shows in the preview straight away.
 */
export function AccentPicker({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (accent: string) => void;
  invalid?: boolean;
}): ReactNode {
  const named = isNamedAccent(value) ? value : null;
  const custom = named ? null : normalizeHex(value);
  const shown = custom ?? ACCENT_SWATCHES[named ?? "blue"].color;
  const [draft, setDraft] = useState(shown.slice(1));
  // Keep the hex box in step when a swatch, the picker or a preset changes the colour.
  const [synced, setSynced] = useState(shown);
  if (synced !== shown) {
    setSynced(shown);
    setDraft(shown.slice(1));
  }

  /** Applies typed hex: while typing only a full six digits, on leaving three as well. */
  function apply(text: string, final: boolean): boolean {
    const digits = text.trim().replace(/^#/, "");
    const hex = final || digits.length === 6 ? normalizeHex(digits) : null;
    if (hex) onChange(hex);
    return Boolean(hex);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
      <RadioGroupPrimitive.Root
        aria-label="Warna aksen siap pakai"
        value={named ?? ""}
        onValueChange={onChange}
        orientation="horizontal"
        className="flex flex-wrap gap-2"
      >
        {ACCENTS.map((accent) => (
          <RadioGroupPrimitive.Item
            key={accent}
            value={accent}
            aria-label={ACCENT_SWATCHES[accent].label}
            title={ACCENT_SWATCHES[accent].label}
            className="grid size-9 place-items-center rounded-full inset-ring inset-ring-foreground/15 ring-offset-2 ring-offset-background transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:ring-2 data-[state=checked]:ring-foreground"
            style={{ backgroundColor: ACCENT_SWATCHES[accent].color }}
          >
            <RadioGroupPrimitive.Indicator>
              <Check className="size-4 text-white" aria-hidden />
            </RadioGroupPrimitive.Indicator>
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>

      <span aria-hidden className="hidden h-6 w-px bg-border sm:block" />

      <div className="flex items-center gap-2">
        <label
          title="Pilih warna sendiri"
          className={cn(
            "relative grid size-9 shrink-0 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-background transition-shadow has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
            custom && "ring-2 ring-foreground"
          )}
          style={{ background: custom ?? RAINBOW }}
        >
          <input
            type="color"
            value={shown}
            onChange={(event) => onChange(event.target.value)}
            aria-label="Pilih warna aksen sendiri"
            className="absolute inset-0 size-full cursor-pointer rounded-full opacity-0"
          />
          {custom ? (
            <Check
              aria-hidden
              className="pointer-events-none size-4"
              style={{ color: readableOn(custom) }}
            />
          ) : (
            <Pipette
              aria-hidden
              className="pointer-events-none size-4 text-white drop-shadow-[0_1px_1px_rgb(0_0_0/0.45)]"
            />
          )}
        </label>
        <InputGroup className="w-32">
          <InputGroupAddon>
            <InputGroupText>#</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Kode warna aksen (hex)"
            placeholder="2563eb"
            value={draft}
            maxLength={7}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={invalid}
            className="font-mono uppercase"
            onChange={(event) => {
              setDraft(event.target.value);
              apply(event.target.value, false);
            }}
            onBlur={() => {
              if (!apply(draft, true)) setDraft(shown.slice(1));
            }}
          />
        </InputGroup>
      </div>
    </div>
  );
}
