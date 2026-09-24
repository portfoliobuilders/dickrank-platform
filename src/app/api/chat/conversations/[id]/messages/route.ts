import { chatMessageSchema, listMessages, requireChatUser, saveChatMessage } from '@/lib/chat';
import { publishChatMessage } from '@/lib/chat-socket';
import { handle, json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireChatUser(request);
    return json(await listMessages(user.id, params.id));
  });
}

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireChatUser(request);
    const input = chatMessageSchema.parse({ ...(await request.json()), roomId: params.id });
    const saved = await saveChatMessage(user.id, params.id, input.message);
    publishChatMessage(params.id, saved);
    return json(saved, 201);
  });
}
