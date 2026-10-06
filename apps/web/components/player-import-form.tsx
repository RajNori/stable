"use client";

import { useState, type CSSProperties } from "react";
import { PLAYER_IMPORT_MAX_ROWS } from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";

type ImportRow = {
  firstName: string;
  lastName: string;
  sourcePlayerId: string;
};

type PlayerImportFormProps = {
  clubId: string;
  action: (formData: FormData) => void | Promise<void>;
};

const EMPTY_ROW: ImportRow = {
  firstName: "",
  lastName: "",
  sourcePlayerId: "",
};

export function PlayerImportForm({ clubId, action }: PlayerImportFormProps) {
  const theme = themeFor("mustangs");
  const [rows, setRows] = useState<ImportRow[]>([{ ...EMPTY_ROW }]);

  function update(index: number, field: keyof ImportRow, value: string): void {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="clubId" value={clubId} />
      <input type="hidden" name="rows" value={JSON.stringify(rows)} />
      <div style={{ display: "grid", gap: theme.space[4] }}>
        {rows.map((row, index) => (
          <fieldset
            key={index}
            style={{
              border: `1px solid ${theme.color.border.default}`,
              borderRadius: theme.radius.sm,
              padding: theme.space[3],
            }}
          >
            <legend>Import row {index + 1}</legend>
            <label htmlFor={`import-first-${index}`}>
              Given name
              <input
                id={`import-first-${index}`}
                value={row.firstName}
                maxLength={80}
                onChange={(event) =>
                  update(index, "firstName", event.target.value)
                }
                style={inputStyle(theme)}
              />
            </label>
            <label htmlFor={`import-last-${index}`}>
              Surname
              <input
                id={`import-last-${index}`}
                value={row.lastName}
                maxLength={80}
                onChange={(event) =>
                  update(index, "lastName", event.target.value)
                }
                style={inputStyle(theme)}
              />
            </label>
            <label htmlFor={`import-source-${index}`}>
              Source id
              <input
                id={`import-source-${index}`}
                value={row.sourcePlayerId}
                maxLength={80}
                onChange={(event) =>
                  update(index, "sourcePlayerId", event.target.value)
                }
                style={inputStyle(theme)}
              />
            </label>
          </fieldset>
        ))}
        <div style={{ display: "flex", gap: theme.space[3] }}>
          <button
            type="button"
            disabled={rows.length >= PLAYER_IMPORT_MAX_ROWS}
            onClick={() => setRows((current) => [...current, { ...EMPTY_ROW }])}
            style={secondaryButton(theme)}
          >
            Add row
          </button>
          <button
            type="button"
            disabled={rows.length <= 1}
            onClick={() => setRows((current) => current.slice(0, -1))}
            style={secondaryButton(theme)}
          >
            Remove row
          </button>
          <button type="submit" style={primaryButton(theme)}>
            Import players
          </button>
        </div>
      </div>
    </form>
  );
}

function inputStyle(theme: ReturnType<typeof themeFor>): CSSProperties {
  return {
    display: "block",
    width: "100%",
    marginTop: theme.space[2],
    minHeight: 44,
    padding: `0 ${theme.space[3]}px`,
    border: `1px solid ${theme.color.border.default}`,
    borderRadius: theme.radius.sm,
    background: theme.color.background.canvas,
    color: theme.color.text.primary,
  };
}

function primaryButton(theme: ReturnType<typeof themeFor>): CSSProperties {
  return {
    minHeight: 44,
    padding: `0 ${theme.space[4]}px`,
    background: theme.color.brand.primary,
    color: theme.color.text.inverse,
    border: `1px solid ${theme.color.brand.primary}`,
    borderRadius: theme.radius.sm,
  };
}

function secondaryButton(theme: ReturnType<typeof themeFor>): CSSProperties {
  return {
    minHeight: 44,
    padding: `0 ${theme.space[4]}px`,
    background: theme.color.background.surface,
    color: theme.color.text.primary,
    border: `1px solid ${theme.color.border.default}`,
    borderRadius: theme.radius.sm,
  };
}
