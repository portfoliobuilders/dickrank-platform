import { requireApiUser } from '@/lib/auth';
import { getStore } from '@/lib/data';
import { ApiError } from '@/lib/errors';
import { handle, json } from '@/lib/http';
import { PAGE_SIZE } from '@/lib/types';
import { contentListQuerySchema, createContentSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function assertAdult(ageVerification: boolean) {
  if (ageVerification !== true) {
    throw new ApiError(403, 'Age verification required');
  }
}

export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    assertAdult(user.ageVerification);
    const url = new URL(request.url);
    const query = contentListQuerySchema.parse({
      category: url.searchParams.get('category') ?? undefined,
      tags: url.searchParams.get('tags') ?? undefined,
      sort: url.searchParams.get('sort') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
      filter: url.searchParams.get('filter') ?? undefined,
      creator: url.searchParams.get('creator') ?? undefined,
    });

    let sort = query.sort;
    let premiumOnly = false;
    let followingOnly = false;
    if (query.filter === 'popular') sort = 'popular';
    if (query.filter === 'new') sort = 'newest';
    if (query.filter === 'premium') premiumOnly = true;
    if (query.filter === 'following') followingOnly = true;

    const result = await getStore().listContent(
      {
        category: query.category,
        tags: query.tags
          ?.split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        sort,
        page: query.page,
        pageSize: PAGE_SIZE,
        premiumOnly,
        followingOnly,
        creatorUsername: query.creator,
      },
      user.id,
    );
    return json(result);
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    assertAdult(user.ageVerification);
    const input = createContentSchema.parse(await request.json());
    const content = await getStore().createContent(user.id, input);
    return json(content, 201);
  });
}
