# Feature Package Instructions

Business behaviour lives in vertical slices.

A slice may contain domain/application/contracts/infrastructure adapters/tests, but must not depend on React/Expo/Next.

Expose intention-revealing operations such as:
- confirmAttendance
- requestDutySwap
- acceptDutySwap
- publishAnnouncement
- completePostGameReview

Avoid generic CRUD service APIs.
