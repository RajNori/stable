import type {
  PostGameReview,
  RecognitionCategory,
  ReviewFocusCode,
} from "@stable/coaching-review";
import {
  RECOGNITION_CATEGORIES,
  REVIEW_FOCUS_CODES,
} from "@stable/coaching-review";
import { themeFor } from "@stable/design-tokens";

type PlayerOption = { playerId: string; label: string };
type Props = {
  review: PostGameReview;
  players: readonly PlayerOption[];
  privateNotes: ReadonlyMap<string, string>;
  canWrite: boolean;
  canWritePrivateNotes: boolean;
  saveReviewAction: (formData: FormData) => void | Promise<void>;
  saveRecognitionAction: (formData: FormData) => void | Promise<void>;
  removeRecognitionAction: (formData: FormData) => void | Promise<void>;
  savePrivateNoteAction: (formData: FormData) => void | Promise<void>;
};

const focusLabels: Record<ReviewFocusCode, string> = {
  SHOOTING: "Shooting",
  BALL_HANDLING: "Ball handling",
  PASSING: "Passing",
  REBOUNDING: "Rebounding",
  DEFENCE: "Defence",
  COMMUNICATION: "Communication",
  TEAMWORK: "Teamwork",
  TRANSITION: "Transition",
};
const categoryLabels: Record<RecognitionCategory, string> = {
  MVP: "MVP / Player of the Game",
  HUSTLE: "Hustle",
  DEFENCE: "Defence",
  TEAMWORK: "Teamwork",
};

export function PostGameReviewPanel(props: Props) {
  const theme = themeFor("mustangs");
  const style = {
    background: theme.color.background.surface,
    color: theme.color.text.primary,
    border: `1px solid ${theme.color.border.default}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.sm,
    padding: theme.space[6],
    marginTop: theme.space[5],
  };
  const names = new Map(
    props.players.map((player) => [player.playerId, player.label]),
  );
  return (
    <section aria-label="Post-game review" style={style}>
      <h2 style={{ marginTop: 0 }}>Post-game review</h2>
      <p>
        {props.review.completedAt === null
          ? "Draft"
          : `Completed ${props.review.completedAt}`}
      </p>
      {props.canWrite ? (
        <form action={props.saveReviewAction}>
          <input type="hidden" name="clubId" value={props.review.clubId} />
          <input type="hidden" name="teamId" value={props.review.teamId} />
          <input type="hidden" name="eventId" value={props.review.eventId} />
          <label>
            What worked
            <textarea
              aria-label="What worked"
              name="whatWorked"
              maxLength={2000}
              defaultValue={props.review.whatWorked}
            />
          </label>
          <label>
            What needs improvement
            <textarea
              aria-label="What needs improvement"
              name="needsImprovement"
              maxLength={2000}
              defaultValue={props.review.needsImprovement}
            />
          </label>
          <fieldset>
            <legend>Practice focus (choose up to five)</legend>
            {REVIEW_FOCUS_CODES.map((code) => (
              <label key={code}>
                <input
                  type="checkbox"
                  name="focusCodes"
                  value={code}
                  defaultChecked={props.review.focusCodes.includes(code)}
                />
                {focusLabels[code]}
              </label>
            ))}
          </fieldset>
          <button type="submit" name="complete" value="false">
            Save draft
          </button>
          <button type="submit" name="complete" value="true">
            Complete review
          </button>
        </form>
      ) : (
        <>
          <p>What worked: {props.review.whatWorked || "—"}</p>
          <p>What needs improvement: {props.review.needsImprovement || "—"}</p>
          <ul>
            {props.review.focusCodes.map((code) => (
              <li key={code}>{focusLabels[code]}</li>
            ))}
          </ul>
        </>
      )}

      <h3>Recognition</h3>
      <p>Staff-facing recognition. This is not a ranking.</p>
      {props.canWrite ? (
        <form action={props.saveRecognitionAction}>
          <input type="hidden" name="clubId" value={props.review.clubId} />
          <input type="hidden" name="teamId" value={props.review.teamId} />
          <input type="hidden" name="eventId" value={props.review.eventId} />
          <label>
            Player
            <select name="playerId" required defaultValue="">
              <option value="" disabled>
                Select a player
              </option>
              {props.players.map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {player.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Recognition
            <select name="category" required defaultValue="MVP">
              {RECOGNITION_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {categoryLabels[category]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Optional staff note
            <input name="recognitionNote" maxLength={500} />
          </label>
          <button type="submit">Save recognition</button>
        </form>
      ) : null}
      {props.review.recognitions.length === 0 ? (
        <p>No recognition recorded.</p>
      ) : (
        <ul aria-label="Staff recognition">
          {props.review.recognitions.map((item) => (
            <li key={`${item.playerId}-${item.category}`}>
              {names.get(item.playerId) ?? "Player"}:{" "}
              {categoryLabels[item.category]}
              {item.note === null ? "" : ` — ${item.note}`}
              {props.canWrite ? (
                <form action={props.removeRecognitionAction}>
                  <input
                    type="hidden"
                    name="clubId"
                    value={props.review.clubId}
                  />
                  <input
                    type="hidden"
                    name="teamId"
                    value={props.review.teamId}
                  />
                  <input
                    type="hidden"
                    name="eventId"
                    value={props.review.eventId}
                  />
                  <input type="hidden" name="playerId" value={item.playerId} />
                  <input type="hidden" name="category" value={item.category} />
                  <button type="submit">
                    Remove {categoryLabels[item.category]} recognition
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <h3>Private player notes</h3>
      <p>🔒 Private to coaching staff</p>
      {props.canWritePrivateNotes ? (
        props.players.map((player) => (
          <form key={player.playerId} action={props.savePrivateNoteAction}>
            <input type="hidden" name="clubId" value={props.review.clubId} />
            <input type="hidden" name="teamId" value={props.review.teamId} />
            <input type="hidden" name="eventId" value={props.review.eventId} />
            <input type="hidden" name="playerId" value={player.playerId} />
            <label>
              {player.label} — private coaching note
              <textarea
                aria-label={`${player.label} private coaching note`}
                name="note"
                maxLength={2000}
                defaultValue={props.privateNotes.get(player.playerId) ?? ""}
              />
            </label>
            <button type="submit">Save private note</button>
          </form>
        ))
      ) : (
        <p>Private notes are available to active coaches for this team.</p>
      )}
    </section>
  );
}
