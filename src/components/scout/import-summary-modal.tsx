"use client";

import { ScoutModal } from "@/components/scout/scout-modal";
import { ScoutDisplayTitle, ScoutPrimaryBtn } from "@/components/scout/scout-box";
import { ImportAuditDetails, importResultHasChanges } from "@/components/scout/import-audit-details";
import type { ClientImportApplyResult } from "@/lib/client-import/types";
import { color, fontSans } from "@/lib/typography";

const muted: React.CSSProperties = {
  fontFamily: fontSans,
  fontSize: 13,
  color: color.muted,
  margin: 0,
  lineHeight: 1.5,
};

export function ImportSummaryModal({
  open,
  result,
  clientUserId,
  onClose,
}: {
  open: boolean;
  result: ClientImportApplyResult;
  clientUserId?: string;
  onClose: () => void;
}) {
  const hasChanges = importResultHasChanges(result);

  return (
    <ScoutModal open={open} onClose={onClose} maxWidth={680} bruddle ariaLabelledBy="import-summary-title">
      <ScoutDisplayTitle id="import-summary-title" size={22} style={{ margin: "0 0 8px" }}>
        Import summary
      </ScoutDisplayTitle>
      <p style={{ ...muted, marginBottom: 16 }}>
        {hasChanges
          ? "Import finished. Review what changed below, then spot-check in the client profile."
          : "Import finished — nothing new was written (rows may have been skipped or already matched)."}
      </p>

      <div style={{ maxHeight: "52vh", overflowY: "auto", paddingRight: 4, marginBottom: 16 }}>
        <ImportAuditDetails result={result} clientUserId={clientUserId} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <ScoutPrimaryBtn onClick={onClose}>Done</ScoutPrimaryBtn>
      </div>
    </ScoutModal>
  );
}
