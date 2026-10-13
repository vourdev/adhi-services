import { Fragment, type ReactNode } from "react";

import { SOCIAL_LABELS } from "@/lib/domain";
import { type ProfileLook, surfaceAttributes } from "@/lib/profile-look";
import type { PublicBlock, PublicProfile } from "@/lib/public-types";

import { BioText } from "./bio-text";
import { HeadingBlock, LinkBlock, ProductBlock, ProductTile } from "./blocks";
import { Icon } from "./icon";
import { MediaImage } from "./media-image";
import { ShareButton } from "./share-button";
import { SOCIAL_ICONS } from "./social-icon";

type ProductData = Extract<PublicBlock, { type: "product" }>;
type Group =
  | { kind: "block"; block: Exclude<PublicBlock, ProductData> }
  | { kind: "products"; id: string; items: ProductData[] };

/** Products next to each other share a grid; everything else stays one per row. */
function groupBlocks(blocks: PublicBlock[]): Group[] {
  const groups: Group[] = [];
  for (const block of blocks) {
    if (block.type !== "product") {
      groups.push({ kind: "block", block });
      continue;
    }
    const last = groups.at(-1);
    if (last?.kind === "products") last.items.push(block);
    else groups.push({ kind: "products", id: block.id, items: [block] });
  }
  return groups;
}

/**
 * The public profile, mobile first: edge-to-edge cover, photo overlapping
 * its lower edge, name and bio aligned left, social icons, then the blocks.
 * Layout switches use container queries, so the dashboard preview renders
 * the phone layout even on a wide screen. Pure presentation.
 */
export function ProfileView({
  profile,
  footer,
  preview = false,
}: {
  profile: PublicProfile;
  footer?: ReactNode;
  /** Dashboard preview: no landmark elements, no share button. */
  preview?: boolean;
}): ReactNode {
  const Main = preview ? "div" : "main";
  const Name = preview ? "p" : "h1";
  const hasCover = Boolean(profile.coverUrl);

  return (
    <div className="@container">
      <div className="mx-auto w-full max-w-[34rem] px-4 pb-10 @xl:pt-6">
        {profile.coverUrl ? (
          <div className="-mx-4 @xl:mx-0">
            <MediaImage
              src={profile.coverUrl}
              alt=""
              width={1600}
              height={900}
              priority
              className="p-cover aspect-video w-full bg-p-line object-cover @xl:rounded-[var(--p-r-card)]"
            />
          </div>
        ) : null}

        <header className={hasCover ? "" : "pt-8"}>
          <div
            // On phones the photo is large next to the cover, so it overlaps less and hides less of it.
            className={`flex items-end justify-between gap-3 ${hasCover ? "-mt-7 @xl:-mt-11" : ""}`}
          >
            {profile.avatarUrl ? (
              <MediaImage
                src={profile.avatarUrl}
                alt={`Foto ${profile.displayName}`}
                width={320}
                height={320}
                eager
                className="p-avatar relative size-26 shrink-0 rounded-full bg-p-line object-cover object-[50%_30%] @xl:size-28"
              />
            ) : (
              <span
                aria-hidden
                className="p-avatar relative grid size-26 shrink-0 place-items-center rounded-full bg-p-accent text-4xl font-bold text-p-accent-fg @xl:size-28"
              >
                {profile.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
            {preview ? null : <ShareButton title={profile.displayName} />}
          </div>

          <Name className="p-name mt-3 text-[1.625rem] leading-tight font-bold tracking-tight text-balance">
            {profile.displayName}
          </Name>
          {profile.bio ? (
            <p className="mt-1.5 text-[15px] leading-relaxed text-pretty whitespace-pre-line text-p-fg/75">
              <BioText
                text={profile.bio}
                linkClassName="font-semibold text-p-accent-ink underline-offset-4 hover:underline"
              />
            </p>
          ) : null}

          {profile.socials.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Media sosial">
              {profile.socials.map((social) => {
                const external = /^https?:/i.test(social.url);
                const label = SOCIAL_LABELS[social.platform];
                return (
                  <li key={social.id} className="group/social relative">
                    <a
                      href={social.url}
                      {...(external
                        ? { target: "_blank", rel: "noopener noreferrer me" }
                        : {})}
                      aria-label={label}
                      className="p-tile p-press grid size-11 place-items-center text-p-fg hover:text-p-accent-ink"
                    >
                      <Icon
                        icon={SOCIAL_ICONS[social.platform]}
                        className="size-[21px]"
                      />
                    </a>
                    {/* Hover/focus label; the link's aria-label already names it for screen readers. */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 translate-y-1 rounded-lg bg-p-fg px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-p-bg opacity-0 shadow-[0_6px_16px_-6px_rgb(17_24_39/0.45)] transition-[opacity,translate] duration-150 group-focus-within/social:translate-y-0 group-focus-within/social:opacity-100 group-hover/social:translate-y-0 group-hover/social:opacity-100 motion-reduce:transition-none"
                    >
                      {label}
                      <span className="absolute top-full left-1/2 -mt-1 size-2 -translate-x-1/2 rotate-45 rounded-[1px] bg-p-fg" />
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </header>

        <Main
          {...(preview ? {} : { id: "konten" })}
          className="mt-7 flex flex-col gap-3"
        >
          {profile.blocks.length === 0 ? (
            // Visitors see nothing here; only the dashboard preview explains the empty list.
            preview ? (
              <p className="rounded-[var(--p-r-card)] border border-dashed border-p-line px-4 py-10 text-center text-sm text-p-muted">
                Belum ada link yang ditampilkan.
              </p>
            ) : null
          ) : (
            groupBlocks(profile.blocks).map((group) => {
              if (group.kind === "products") {
                // Pairs go in the grid; an odd one out gets a full-width row instead of a gap.
                const paired = group.items.slice(
                  0,
                  group.items.length - (group.items.length % 2)
                );
                const single =
                  group.items.length % 2 ? group.items.at(-1) : null;
                return (
                  <Fragment key={group.id}>
                    {paired.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {paired.map((item) => (
                          <ProductTile
                            key={item.id}
                            product={item.product}
                            href={item.href}
                          />
                        ))}
                      </div>
                    ) : null}
                    {single ? (
                      <ProductBlock
                        product={single.product}
                        href={single.href}
                      />
                    ) : null}
                  </Fragment>
                );
              }
              const { block } = group;
              if (block.type === "heading")
                return <HeadingBlock key={block.id} title={block.title} />;
              return <LinkBlock key={block.id} block={block} />;
            })
          )}
        </Main>

        {footer}
      </div>
    </div>
  );
}

/**
 * The page background and every p-* token for one profile's look (see
 * lib/profile-look.ts). `page` marks the full-page surface, whose colour also
 * fills the browser canvas; dashboard previews leave it off.
 */
export function ProfileSurface({
  look,
  page = true,
  className = "",
  children,
}: {
  look: ProfileLook;
  page?: boolean;
  className?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div
      className={`profile-surface antialiased ${page ? "min-h-dvh" : ""} ${className}`}
      {...surfaceAttributes(look)}
      {...(page ? { "data-page-surface": "" } : {})}
    >
      {children}
    </div>
  );
}
