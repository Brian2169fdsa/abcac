import { ChatWidget } from "@/components/assistant/chat-widget";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  // The conversational member assistant rides alongside the manual portal UI.
  // It degrades gracefully when ANTHROPIC_API_KEY is unset (the widget shows a
  // friendly notice; the route returns 503).
  return (
    <>
      {children}
      <ChatWidget surface="member" />
    </>
  );
}
