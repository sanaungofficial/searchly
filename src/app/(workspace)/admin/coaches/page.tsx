import { redirect } from "next/navigation";

/** Legacy route — expert hub lives on /admin/experts. */
export default async function AdminCoachesRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
  }

  const query = qs.toString();
  redirect(query ? `/admin/experts?${query}` : "/admin/experts");
}
