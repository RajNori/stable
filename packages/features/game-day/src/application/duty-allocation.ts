export type DutyCandidate = {
  userId: string;
  priorCount: number;
};

export type OpenDuty = {
  dutyId: string;
  dutyType: string;
  label: string;
};

export type DutyProposal = {
  dutyId: string;
  userId: string;
  priorCount: number;
};

export function compareDutyCandidates(
  left: DutyCandidate,
  right: DutyCandidate,
): number {
  if (left.priorCount !== right.priorCount) {
    return left.priorCount - right.priorCount;
  }
  if (left.userId < right.userId) {
    return -1;
  }
  if (left.userId > right.userId) {
    return 1;
  }
  return 0;
}

export function proposeDutyAllocation(input: {
  duties: readonly OpenDuty[];
  candidates: readonly DutyCandidate[];
}): { proposals: DutyProposal[]; fingerprint: string } {
  const counts = new Map(
    input.candidates.map((candidate) => [
      candidate.userId,
      candidate.priorCount,
    ]),
  );
  const duties = [...input.duties].sort((left, right) =>
    compareDutyCandidates(
      { userId: left.dutyId, priorCount: 0 },
      { userId: right.dutyId, priorCount: 0 },
    ),
  );
  const proposals: DutyProposal[] = [];
  for (const duty of duties) {
    const ranked = [...counts.entries()].sort((left, right) =>
      compareDutyCandidates(
        { userId: left[0], priorCount: left[1] },
        { userId: right[0], priorCount: right[1] },
      ),
    );
    const chosen = ranked[0];
    if (chosen === undefined) {
      break;
    }
    proposals.push({
      dutyId: duty.dutyId,
      userId: chosen[0],
      priorCount: chosen[1],
    });
    counts.set(chosen[0], chosen[1] + 1);
  }
  return {
    proposals,
    fingerprint: proposals
      .map(
        (proposal) =>
          `${proposal.dutyId}:${proposal.userId}:${String(proposal.priorCount)}`,
      )
      .join("|"),
  };
}
