// Who to contact + drafted messages for every active VC (or named ones).
//   npm run contacts                 # all active VCs
//   npm run contacts -- vc01 vc58    # named
// Tavily: at most 1 search per firm (LinkedIn of the top contact). No Exa.
import { loadVcs } from "../lib/db";
import { discoverContacts, refreshMessages, saveContacts } from "../lib/contacts-refresh";
import { geminiUsage } from "../lib/gemini";
import { mapLimit } from "../lib/http";
import { searchUsage } from "../lib/search";

async function main() {
  const only = process.argv.slice(2);
  const vcs = (await loadVcs()).filter((v) => v.website && (only.length === 0 || only.includes(v.seed_key ?? "")));
  console.log(`contacts for ${vcs.length} VCs`);
  let people = 0, emails = 0, linkedins = 0, pitch = 0, drafted = 0;
  await mapLimit(vcs, 4, async (vc) => {
    try {
      const { contacts, channels } = await discoverContacts(vc);
      await saveContacts(vc.id, contacts, channels);
      const n = await refreshMessages(vc);
      people += contacts.length; drafted += n;
      emails += contacts.filter((c) => c.email).length + channels.emails.length;
      linkedins += contacts.filter((c) => c.linkedin_url).length;
      pitch += channels.pitch_url ? 1 : 0;
      console.log(`${vc.seed_key} ${vc.firm}: ${contacts.length} people (${contacts.slice(0, 2).map((c) => `${c.name}, ${c.title ?? "?"}`).join("; ")}) · pitch ${channels.pitch_url ? "yes" : "no"} · emails ${channels.emails.length + contacts.filter((c) => c.email).length} · drafted for ${n}`);
    } catch (e) {
      console.log(`${vc.seed_key} ${vc.firm}: ERROR ${(e as Error).message.slice(0, 120)}`);
    }
  });
  console.log(`\npeople ${people} · with LinkedIn ${linkedins} · published emails ${emails} · pitch forms ${pitch} · contacts with drafts ${drafted}`);
  console.log(`Tavily ${searchUsage.tavily} · Exa ${searchUsage.exa} · Gemini ${geminiUsage.calls}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
