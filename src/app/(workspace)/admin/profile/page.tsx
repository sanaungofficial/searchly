import { redirect } from "next/navigation";

export default function AdminProfilePage() {
  redirect("/expert/offerings?section=profile");
}
