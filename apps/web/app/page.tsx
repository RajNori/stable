import { ClubAdminShell } from "../components/club-admin-shell";
import {
  contextFixtureFromQuery,
  fixtureClubContextInput,
} from "../lib/fixtures";
import { loadClubContext } from "../lib/load-club-context";
import { loadLiveClubContext } from "../lib/load-live-club-context";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const fixtureName = contextFixtureFromQuery(params["fixture"]);

  if (fixtureName === "loading") {
    return <ClubAdminShell presentation={{ status: "loading" }} />;
  }

  const presentation =
    fixtureName === null
      ? await loadLiveClubContext()
      : await loadClubContext(fixtureClubContextInput(fixtureName));

  return <ClubAdminShell presentation={presentation} />;
}
