import { useNavigate } from "react-router";
import { useCreateDirectConversation } from "@/features/conversations/api";

function useSafeNavigate() {
  try {
    return useNavigate();
  } catch {
    return null;
  }
}

export function useOpenConversation() {
  const navigate = useSafeNavigate();
  const direct = useCreateDirectConversation();
  return {
    isPending: direct.isPending,
    error: direct.error,
    reset: direct.reset,
    openExisting: (id: string) => navigate?.(`/app/messages/${id}`),
    openDirect: async (recipientId: string) => {
      const conversation = await direct.mutateAsync({ recipient_id: recipientId });
      navigate?.(`/app/messages/${conversation.id}`);
    },
  };
}
