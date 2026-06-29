import { requireAdmin, isSuperAdmin } from "@/lib/auth";
import {
  fetchProvisionedUserPayload,
  provisionUser,
} from "@/lib/admin-user-provision";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

function parseRole(value: unknown): UserRole {
  if (typeof value === "string" && Object.values(UserRole).includes(value as UserRole)) {
    return value as UserRole;
  }
  return UserRole.USER;
}

function parseCreateUserInput(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const nameRaw = formData.get("name");
  const name = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : null;
  const role = parseRole(formData.get("role"));
  const linkedinRaw = formData.get("linkedinUrl");
  const linkedinUrl = typeof linkedinRaw === "string" && linkedinRaw.trim() ? linkedinRaw.trim() : null;
  const resumeFile = formData.get("resume");
  const file = resumeFile instanceof File && resumeFile.size > 0 ? resumeFile : null;
  const sendInviteRaw = formData.get("sendInvite");
  const sendInvite =
    sendInviteRaw === "true" ||
    sendInviteRaw === "1" ||
    sendInviteRaw === "on";
  const initialPasswordRaw = formData.get("initialPassword");
  const initialPassword =
    typeof initialPasswordRaw === "string" && initialPasswordRaw.trim()
      ? initialPasswordRaw.trim()
      : null;

  return { email, name, role, linkedinUrl, file, sendInvite, initialPassword };
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contentType = req.headers.get("content-type") ?? "";
  let email: string;
  let name: string | null;
  let role: UserRole;
  let linkedinUrl: string | null;
  let file: File | null;
  let sendInvite: boolean;
  let initialPassword: string | null;

  if (contentType.includes("multipart/form-data")) {
    const parsed = parseCreateUserInput(await req.formData());
    ({ email, name, role, linkedinUrl, file, sendInvite, initialPassword } = parsed);
  } else {
    const body = await req.json().catch(() => ({}));
    email = String(body.email ?? "").trim();
    name = body.name?.trim() || null;
    role = parseRole(body.role);
    linkedinUrl = null;
    file = null;
    sendInvite = body.sendInvite !== false;
    initialPassword = body.initialPassword?.trim() || null;
  }

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (role === UserRole.ADMIN && !isSuperAdmin(admin.email)) {
    return NextResponse.json({ error: "Only super admins can create admin accounts." }, { status: 403 });
  }

  if (initialPassword && initialPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  if ((file || linkedinUrl) && role !== UserRole.USER) {
    return NextResponse.json(
      { error: "Resume and LinkedIn import are only available for user accounts." },
      { status: 400 },
    );
  }

  try {
    const result = await provisionUser({
      email,
      name,
      role,
      resumeFile: file,
      linkedinUrl,
      sendInvite: initialPassword ? false : sendInvite,
      initialPassword,
    });

    const user = await fetchProvisionedUserPayload(result.user.id, role);
    if (!user) {
      return NextResponse.json({ error: "User created but could not be loaded." }, { status: 500 });
    }

    return NextResponse.json({
      user,
      invited: result.invited,
      resumeUploaded: result.resumeUploaded,
      linkedinImported: result.linkedinImported,
      warnings: result.warnings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create user.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
