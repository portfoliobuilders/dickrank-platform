import { openConversationSchema, listConversations, openDirectConversation, requireChatUser } from '@/lib/chat';
import { handle, json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireChatUser(request);
    return json(await listConversations(user.id));
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireChatUser(request);
    const input = openConversationSchema.parse(await request.json());
    const conversation = await openDirectConversation(user.id, input.username);
    return json(conversation, 201);
  });
}
