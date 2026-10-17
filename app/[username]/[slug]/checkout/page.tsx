import { notFound, redirect } from "next/navigation";

import { loadProduct } from "@/server/public-data";

type Props = { params: Promise<{ username: string; slug: string }> };

/** The old per-product checkout address; checkout now lives at /[username]/checkout. */
export default async function OldCheckoutPage({
  params,
}: Props): Promise<never> {
  const { username, slug } = await params;
  const loaded = await loadProduct(username, slug);
  if (!loaded) notFound();
  redirect(`/${loaded.profile.username}/checkout?beli=${loaded.product.id}`);
}
