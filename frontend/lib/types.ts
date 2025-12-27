export type User = {
  id: number;
  email: string;
  display_name: string;
  created_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type Conversation = {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: number;
  role: "user" | "assistant" | "system" | string;
  content: string;
  created_at: string;
};

export type ChatResponse = {
  conversation: Conversation;
  user_message: Message;
  assistant_message: Message;
};
