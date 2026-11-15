import { ApiNotice } from "@/components/common/ApiNotice";
import { useAppData } from "@/app/app-data-context";
import { Button } from "@/components/ui/button";
import {
  useCreateProfile,
  useCurrentUser,
} from "@/features/community/api/hooks";
import { ApiError, apiErrorMessage } from "@/lib/api/errors";

export function ApplicationProfileState() {
  const { configurationError } = useAppData();
  const profile = useCurrentUser();
  const onboarding = useCreateProfile();
  if (configurationError) return <ApiNotice error={new ApiError("configuration")} />;
  if (profile.isPending)
    return <ApiNotice loading="Loading your application profile…" />;
  if (profile.error instanceof ApiError && profile.error.status === 409)
    return (
      <section className="p-6" aria-label="Application profile setup">
        <h2 className="text-xl font-semibold">Set up your Core profile</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your application profile from your verified sign-in. Your
          communities and conversations will be linked to this profile.
        </p>
        <Button
          className="mt-4"
          disabled={onboarding.isPending}
          onClick={() => onboarding.mutate()}
        >
          {onboarding.isPending ? "Setting up…" : "Set up profile"}
        </Button>
        {onboarding.error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {apiErrorMessage(onboarding.error)}
          </p>
        )}
      </section>
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
