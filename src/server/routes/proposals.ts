import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { clientIp } from '../lib/audit';
import { ok } from '../lib/http';
import { parseInput } from '../lib/validate';
import { decideProposal, listProposals } from '../services/proposals';

/** Phía người: xem đề xuất của agent gửi tới mình và Chấp nhận / Từ chối. */
export const proposalRoutes = new Hono<AppEnv>();

proposalRoutes.get('/', async (c) => {
  const items = await listProposals(c.env.DB, c.get('auth'), {
    status: c.req.query('status') ?? 'PENDING',
    entityType: c.req.query('entity_type') ?? undefined,
    entityId: c.req.query('entity_id') ?? undefined,
    limit: Number(c.req.query('limit') ?? 100),
  });
  return ok(c, items);
});

const decideSchema = z.object({
  decision: z.enum(['ACCEPTED', 'REJECTED']),
  note: z.string().trim().max(500).optional().nullable(),
});

proposalRoutes.post('/:id/decide', async (c) => {
  const input = parseInput(decideSchema, await c.req.json().catch(() => ({})));
  await decideProposal(c.env.DB, c.get('auth'), c.req.param('id'), input.decision, input.note ?? null, {
    requestId: c.get('requestId'),
    ip: clientIp(c.req.raw.headers),
  });
  return ok(c, { ok: true });
});
