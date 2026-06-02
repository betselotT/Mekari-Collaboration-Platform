"use client";

import { useEffect, useState } from "react";
import { apiClient } from "../../lib/api";
import { useLanguage } from "../../lib/i18n";
import { CommunityGuidelinesAgreement } from "./CommunityGuidelinesAgreement";

type GuidelinesStatus = {
  version: string;
  requiresAcceptance: boolean;
};

export function CommunityGuidelinesModal() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<GuidelinesStatus | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<GuidelinesStatus>("/api/users/me/community-guidelines")
      .then((response) => setStatus(response.data))
      .catch((err) => {
        setStatus({ version: "", requiresAcceptance: true });
        setError(err.response?.data?.error?.message || t("guidelines.eula.loadError"));
      });
  }, [t]);

  async function acceptGuidelines() {
    if (!status || !acknowledged || saving) return;

    setSaving(true);
    setError(null);
    try {
      await apiClient.post("/api/users/me/community-guidelines/accept", {
        version: status.version,
        accepted: true,
      });
      setStatus({ ...status, requiresAcceptance: false });
      setAcknowledged(false);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t("guidelines.eula.acceptError"));
    } finally {
      setSaving(false);
    }
  }

  if (!status?.requiresAcceptance) return null;

  return (
    <CommunityGuidelinesAgreement
      version={status.version}
      acknowledged={acknowledged}
      saving={saving}
      error={error}
      onAcknowledgedChange={setAcknowledged}
      onConfirm={acceptGuidelines}
    />
  );
}
