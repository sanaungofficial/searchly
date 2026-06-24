import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const referrer = await prisma.user.findFirst({
    where: { OR: [{ referralCode: code }, { id: code }] },
    select: { id: true, referralCode: true },
  });

  const cookieStore = await cookies();
  cookieStore.set("kimchi_ref", referrer?.referralCode ?? code, {
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
  });

  // PartneroJS reads ?ref= as the referring customer key (Kimchi user id).
  const refParam = referrer?.id ?? code;
  redirect(`/signup?ref=${encodeURIComponent(refParam)}`);
}
