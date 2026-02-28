import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { connectSocket } from "../socket";
import type { Message } from "../types";

type Conversation = {
  friend: {
    userId: string;
    username: string;
    displayName: string;
    avatar: string;
  };
  latestMessage: Message | null;
  unreadCount: number;
};

export function MessagesScreen() {
  const { friendId } = useParams();
  const navigate = useNavigate();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeFriend = useMemo(() => convos.find((c) => c.friend.userId === friendId) ?? null, [convos, friendId]);

  async function loadConvos() {
    const data = await api<Conversation[]>("/messages/conversations");
    setConvos(data);
    return data;
  }

  async function loadMessages(currentFriendId: string) {
    const data = await api<Message[]>(`/messages/${currentFriendId}`);
    setMessages(data);
  }

  useEffect(() => {
    loadConvos()
      .then((data) => {
        if (!friendId && data.length > 0) {
          navigate(`/messages/${data[0].friend.userId}`, { replace: true });
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Load failed"));
  }, [friendId]);

  useEffect(() => {
    if (!friendId) return;
    loadMessages(friendId).catch((err) => setError(err instanceof Error ? err.message : "Load failed"));
  }, [friendId]);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const onNewMessage = (message: Message) => {
      if (friendId && (message.senderId === friendId || message.recipientId === friendId)) {
        setMessages((current) => [...current, message]);
      }
      loadConvos().catch(() => undefined);
    };

    socket.on("message:new", onNewMessage);
    return () => {
      socket.off("message:new", onNewMessage);
    };
  }, [friendId]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!friendId || !text.trim()) return;

    const message = await api<Message>(`/messages/${friendId}`, "POST", { content: text.trim() });
    setMessages((current) => [...current, message]);
    setText("");
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <h1 className="title">Messages</h1>
        {convos.map((conversation) => (
          <Link key={conversation.friend.userId} to={`/messages/${conversation.friend.userId}`}>
            <div className="list-item">
              <div>
                <strong>{conversation.friend.displayName}</strong>
                <div className="small">@{conversation.friend.username}</div>
                <div className="small">{conversation.latestMessage?.content ?? "No messages yet"}</div>
              </div>
              {conversation.unreadCount > 0 ? <span className="badge">{conversation.unreadCount}</span> : null}
            </div>
          </Link>
        ))}
      </section>

      {activeFriend ? (
        <section className="panel stack">
          <h2 style={{ margin: 0 }}>Chat with {activeFriend.friend.displayName}</h2>
          <div className="stack" style={{ maxHeight: 280, overflowY: "auto" }}>
            {messages.map((message) => (
              <div key={message.id} className="list-item">
                <div>
                  <div>{message.content}</div>
                  <div className="small">{new Date(message.sentAt).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
          <form className="row" onSubmit={sendMessage}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type message" />
            <button type="submit">Send</button>
          </form>
        </section>
      ) : null}

      {error ? <p style={{ color: "#fca5a5", margin: 0 }}>{error}</p> : null}
    </div>
  );
}
