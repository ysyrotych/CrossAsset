import { redirect } from "next/navigation";

// The Daily Issue has been merged into the unified Dashboard at "/".
export default function IssueRedirect() {
  redirect("/");
}
