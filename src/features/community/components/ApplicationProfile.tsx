import { useEffect, useRef } from "react";
import { ApiNotice } from "@/components/common/ApiNotice";
import { useAppData } from "@/app/app-data-context";
import {
  useCreateProfile,
  useCurrentUser,
} from "@/features/community/api/hooks";
import { ApiError } from "@/lib/api/errors";

export function ApplicationProfileState() {
  const { configurationError } = useAppData();
  const profile = useCurrentUser();
  const onboarding = useCreateProfile();
  const triggered = useRef(false);

  const isConflict =
    profile.error instanceof ApiError && profile.error.status === 409;

  useEffect(() => {
    if (isConflict && !triggered.current && !onboarding.isPending) {
      triggered.current = true;
      onboarding.mutate();
    }
  }, [isConflict, onboarding]);

  if (configurationError) return <ApiNotice error={new ApiError("configuration")} />;
  if (profile.isPending || isConflict || onboarding.isPending)
    return <ApiNotice loading="Loading your application profile…" />;
  if (onboarding.error)
    return (
      <ApiNotice
        error={onboarding.error}
        onRetry={() => {
          triggered.current = false;
          onboarding.mutate();
        }}
      />
    );
  return profile.error ? (
    <ApiNotice
      error={profile.error}
      onRetry={() => {
        void profile.refetch();
      }}
    />
  ) : null;
}
