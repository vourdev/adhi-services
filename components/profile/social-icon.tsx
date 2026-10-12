import {
  Briefcase01Icon,
  Facebook01Icon,
  GithubIcon,
  Globe02Icon,
  InstagramIcon,
  Linkedin01Icon,
  Mail01Icon,
  NewTwitterIcon,
  TelegramIcon,
  ThreadsIcon,
  TiktokIcon,
  WhatsappIcon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons";

import type { SocialPlatform } from "@/lib/domain";

import type { IconSvgElement } from "./icon";

export const SOCIAL_ICONS: Record<SocialPlatform, IconSvgElement> = {
  instagram: InstagramIcon,
  tiktok: TiktokIcon,
  youtube: YoutubeIcon,
  linkedin: Linkedin01Icon,
  github: GithubIcon,
  x: NewTwitterIcon,
  facebook: Facebook01Icon,
  threads: ThreadsIcon,
  whatsapp: WhatsappIcon,
  telegram: TelegramIcon,
  email: Mail01Icon,
  website: Globe02Icon,
  portfolio: Briefcase01Icon,
};
