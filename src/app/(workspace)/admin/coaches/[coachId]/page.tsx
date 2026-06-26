import { redirect } from "next/navigation";

/** Legacy detail URL — opens coach hub drawer on the list page. */
export default async function AdminCoachDetailRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ coachId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { coachId } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
  }

  qs.set("coachId", coachId);
  redirect(`/admin/coaches?${qs.toString()}`);
}
