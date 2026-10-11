"use client";
// Who to contact at a firm + drafted messages, inside the workspace.
// Nothing is sent from here: Copy, or "Open in email" which opens the viewer's
// own mail app pre-filled. Emails shown are only ones the firm publishes.
import { AtSign, Copy, ExternalLink, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import type { ChannelRow, ContactRow } from "@/lib/queries";

const LEVEL: Record<ContactRow["poc_level"], string> = {
  decision_maker: "Decision-maker", partner: "Partner", principal: "Principal", associate: "Associate", other: "Team",
};
const KIND: Record<ContactRow["messages"][number]["kind"], string> = { email: "Email", linkedin_note: "LinkedIn note", follow_up: "Follow-up" };

type Data = { contacts: ContactRow[]; channels: ChannelRow | null };
const cache = new Map<string, Data>();

function CopyButton({ text, label, done }: { text: string; label: string; done: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setMsg(done);
          } catch {
            setMsg("Couldn't copy. Select the text instead");
          }
          setTimeout(() => setMsg(null), 2000);
        }}
      >
        <Copy size={14} aria-hidden />
        {label}
      </button>
      {msg && <div className="toast" role="status">{msg}</div>}
    </>
  );
}

const mailto = (to: string, subject: string | null, body: string) =>
  `mailto:${to}?subject=${encodeURIComponent(subject ?? "")}&body=${encodeURIComponent(body)}`;

export function WhoToContact({ vcId }: { vcId: string }) {
  const [state, setState] = useState<{ id: string; data: Data | null; failed: boolean }>(() => ({ id: vcId, data: cache.get(vcId) ?? null, failed: false }));
  const [open, setOpen] = useState<number | null>(null);
  const current = state.id === vcId ? state : { id: vcId, data: cache.get(vcId) ?? null, failed: false };

  useEffect(() => {
    if (cache.has(vcId)) return;
    let live = true;
    fetch(`/api/vc/${vcId}/contacts`)
      .then((r) => (r.ok ? (r.json() as Promise<Data>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        cache.set(vcId, d);
        if (live) setState({ id: vcId, data: d, failed: false });
      })
      .catch(() => live && setState({ id: vcId, data: null, failed: true }));
    return () => {
      live = false;
    };
  }, [vcId]);

  const data = current.data;
  if (!data) {
    return (
      <div className="sec" aria-labelledby={`contact-h-${vcId}`}>
        <h3 id={`contact-h-${vcId}`}>Who to contact</h3>
        <p className="small" role="status">{current.failed ? "Couldn't load the team. Open the full page to try again." : "Loading the team…"}</p>
      </div>
    );
  }
  const { contacts, channels } = data;
  const firmEmail = channels?.emails[0] ?? null;
  const openId = open ?? contacts.find((c) => c.messages.length)?.id ?? null;

  return (
    <div className="sec contacts" aria-labelledby={`contact-h-${vcId}`}>
      <h3 id={`contact-h-${vcId}`}>Who to contact</h3>
      {channels && (channels.pitch_url || channels.emails.length > 0 || channels.contact_url) && (
        <p className="small" style={{ margin: "0 0 10px" }}>
          Firm routes:{" "}
          {[
            channels.pitch_url && <a key="p" href={channels.pitch_url} target="_blank" rel="noopener noreferrer">pitch form</a>,
            ...channels.emails.map((e) => <a key={e} href={`mailto:${e}`}>{e}</a>),
            channels.contact_url && (
              <span key="c">
                <a href={channels.contact_url} target="_blank" rel="noopener noreferrer">contact page</a>
                {channels.email_hidden_from_bots ? " (email shown there)" : ""}
              </span>
            ),
          ]
            .filter(Boolean)
            .map((el, i) => (
              <span key={i}>{i > 0 && " · "}{el}</span>
            ))}
        </p>
      )}
      {contacts.length === 0 ? (
        <p className="small">No team listed on the firm&apos;s website yet.</p>
      ) : (
        <ul className="people">
          {contacts.map((c) => {
            const to = c.email ?? firmEmail;
            const isOpen = openId === c.id;
            return (
              <li key={c.id}>
                <div className="person-h">
                  <span className="pn">{c.name}</span>
                  <span className="small">{c.title}</span>
                  <span className={`lvl${c.poc_level === "decision_maker" ? " dm" : ""}`}>
                    {LEVEL[c.poc_level]}
                    {c.relevant ? " · logistics/B2B focus" : ""}
                  </span>
                </div>
                {(c.focus || c.bio) && <p className="small" style={{ margin: "4px 0 0", maxWidth: "64ch" }}>{c.focus || c.bio}</p>}
                <div className="links">
                  {c.linkedin_url && (
                    <a className="chip" href={c.linkedin_url} target="_blank" rel="noopener noreferrer">
                      LinkedIn <ExternalLink size={12} aria-hidden /><span className="sr-only">(opens in a new tab)</span>
                    </a>
                  )}
                  {c.x_url && (
                    <a className="chip" href={c.x_url} target="_blank" rel="noopener noreferrer">
                      X <ExternalLink size={12} aria-hidden /><span className="sr-only">(opens in a new tab)</span>
                    </a>
                  )}
                  {c.email && (
                    <a className="chip" href={`mailto:${c.email}`}>
                      <AtSign size={12} aria-hidden /> {c.email}
                    </a>
                  )}
                  <a className="chip" href={c.source_url} target="_blank" rel="noopener noreferrer">
                    Team page <ExternalLink size={12} aria-hidden /><span className="sr-only">(opens in a new tab)</span>
                  </a>
                  {c.messages.length > 0 && (
                    <button type="button" className="btn push drafts-btn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? -1 : c.id)}>
                      {isOpen ? "Hide drafts" : "Show drafts"}
                    </button>
                  )}
                </div>
                {isOpen &&
                  c.messages.map((m) => (
                    <div key={m.kind} className="draft">
                      <p className="meta">
                        {KIND[m.kind]}
                        {m.subject ? `: ${m.subject}` : ""}
                      </p>
                      <p>{m.body}</p>
                      <div className="links" style={{ marginTop: 0 }}>
                        <CopyButton text={m.subject ? `Subject: ${m.subject}\n\n${m.body}` : m.body} label={`Copy ${KIND[m.kind].toLowerCase()}`} done={`${KIND[m.kind]} copied`} />
                        {m.kind !== "linkedin_note" && to && (
                          <a className="btn" href={mailto(to, m.subject, m.body)}>
                            <Mail size={14} aria-hidden /> Open in email
                          </a>
                        )}
                        {m.kind === "linkedin_note" && c.linkedin_url && (
                          <a className="btn" href={c.linkedin_url} target="_blank" rel="noopener noreferrer">
                            Open LinkedIn <ExternalLink size={14} aria-hidden /><span className="sr-only">(opens in a new tab)</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
      <p className="small" style={{ marginTop: 8 }}>
        People come from the firm&apos;s own team page, ordered by who decides. Drafts use only that page and the dated evidence above; fill the [bracketed] parts yourself. Nothing is sent from this page.
      </p>
    </div>
  );
}
