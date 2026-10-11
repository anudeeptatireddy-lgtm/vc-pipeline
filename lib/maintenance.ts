// Daily upkeep, run by the keep-alive cron after its Neon ping:
// 1. Re-draft messages where the firm's best signal changed (reach-out and
//    nudge firms first), so drafts always reference the latest news.
// 2. Re-discover contacts for firms not refreshed in 30 days, a few per day,
//    so the whole list refreshes monthly inside the 300 s function limit.
import { loadVcs } from "./db";
import { discoverContacts, refreshMessages, saveContacts, staleMessageVcs } from "./contacts-refresh";
import { q } from "./sql";

export async function runMaintenance(budgetMs = 230_000) {
  const start = Date.now();
  const left = () => budgetMs - (Date.now() - start);
  const vcs = await loadVcs();
  const byId = new Map(vcs.map((v) => [v.id, v]));
  const priority = (id: string) => (/^(Reach out|Nudge|Light nudge)/.test(byId.get(id)?.recommended_action ?? "") ? 0 : 1);

  let redrafted = 0;
  for (const id of (await staleMessageVcs()).sort((a, b) => priority(a) - priority(b))) {
    if (left() < 45_000) break;
    const vc = byId.get(id);
    if (vc) redrafted += await refreshMessages(vc).catch(() => 0);
  }

  let rediscovered = 0;
  const due = await q<{ id: string }>(
    `select v.id from vcs v left join vc_channels c on c.vc_id = v.id
     where not v.archived and v.website is not null and (c.updated_at is null or c.updated_at < now() - interval '30 days')
     order by c.updated_at nulls first limit 10`,
  );
  for (const { id } of due) {
    if (left() < 90_000) break;
    const vc = byId.get(id);
    if (!vc) continue;
    try {
      const { contacts, channels } = await discoverContacts(vc);
      await saveContacts(vc.id, contacts, channels);
      await refreshMessages(vc);
      rediscovered++;
    } catch {}
  }
  return { redrafted, rediscovered, ms: Date.now() - start };
}
