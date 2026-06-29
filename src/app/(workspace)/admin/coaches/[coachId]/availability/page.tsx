import { redirect } from "next/navigation";

/** Legacy availability URL — availability tab in expert directory drawer. */
export default async function AdminCoachAvailabilityRedirect({
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
  qs.set("tab", "availability");
  redirect(`/admin/experts?${qs.toString()}`);
}
