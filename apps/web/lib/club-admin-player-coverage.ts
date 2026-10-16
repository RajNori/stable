import type { Player } from "@stable/contracts";

export function countActivePlayersMissingGuardian(
  players: readonly Pick<Player, "id" | "active">[],
  activeGuardianPlayerIds: ReadonlySet<string>,
): number {
  return players.filter(
    (player) => player.active && !activeGuardianPlayerIds.has(player.id),
  ).length;
}
