import type {
  ClubContextReader,
  CurrentClubContext,
  Principal,
} from "@stable/contracts";
import { getCurrentClubContext } from "@stable/current-club-context";

export function loadCurrentClubContext(input: {
  principal: Principal | null;
  reader: ClubContextReader;
}): Promise<CurrentClubContext> {
  return getCurrentClubContext({
    principal: input.principal,
    reader: input.reader,
  });
}
