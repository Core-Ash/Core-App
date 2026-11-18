import { useNavigate } from "react-router";
import { useCreateDirectConversation } from "@/features/conversations/api";

export function useOpenConversation() {
  const navigate = useNavigate();
  const direct = useCreateDirectConversation();
  return {
    isPending: direct.isPending,
    error: direct.error,
    reset: direct.reset,
    openExisting: (id: string) => navigate(`/app/messages/${id}`),
    openDirect: async (recipientId: string) => {
      const conversation = await direct.mutateAsync({ recipient_id: recipientId });
      navigate(`/app/messages/${conversation.id}`);
    },
  };
}
