export interface Profile {
  id: string;
  username: string;
  email: string;
  display_name: string;
}
export interface Community {
  id: string;
  name: string;
  owner_id: string;
}
export interface Channel {
  id: string;
  name: string;
  topic: string;
  position: number;
}
export interface Message {
  id: string;
  author_id: string;
  body: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  client_nonce: string;
}
export interface MessageCursor {
  before_time: string;
  before_id: string;
}
export interface MessagePage {
  items: Message[];
  next_cursor: MessageCursor | null;
}
