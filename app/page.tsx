import { caller } from "@/lib/trpc/server";
import { redirect } from "next/navigation";
import LandingPage from "./landing/page";

export default async function RootPage() {
  const trpc = await caller();
  const session = await trpc.auth.whoAmI();

  if (session.state === "ready") {
    redirect("/practice");
  }

  if (session.state === "needs-profile") {
    redirect("/create-profile");
  }

  return <LandingPage />;
}
