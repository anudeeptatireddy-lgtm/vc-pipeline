"use client";
// Who to contact at a firm + drafted messages (dashboard detail page).
// Nothing is sent from here: Copy, or "Open in email" which opens the viewer's
// own mail app pre-filled. Emails shown are only ones the firm publishes.
import { AtSign, Copy, ExternalLink, Mail } from "lucide-react";
import { useState } from "react";
import type { ChannelRow, ContactRow } from "@/lib/queries";

const LEVEL: Record<ContactRow["poc_level"], string> = {
  decision_maker: "Decision-maker", partner: "Partner", principal: "Principal", associate: "Associate", other: "Team",
};
const KIND: Record<ContactRow["messages"][number]["kind"], string> = { email: "Email", linkedin_note: "LinkedIn note", follow_up: "Follow-up" };

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

export function WhoToContact({ contacts, channels }: { contacts: ContactRow[]; channels: ChannelRow | null }) {
  const [open, setOpen] = useState<number | null>(contacts[0]?.id ?? null);
  const firmEmail = channels?.emails[0] ?? null;
  return (
    <section className="section" aria-labelledby="contact-h">
      <h2 id="contact-h">Who to contact</h2>
      {channels && (channels.pitch_url || channels.emails.length > 0 || channels.contact_url) && (
        <p className="meta" style={{ margin: "0 0 10px" }}>
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
        <p className="meta">No team listed on the firm&apos;s website yet.</p>
      ) : (
        <ul className="list">
          {contacts.map((c) => {
            const to = c.email ?? firmEmail;
            return (
              <li key={c.id} className="row">
                <div className="row-head">
                  <span className="firm display">{c.name}</span>
                  <span className="partner">{c.title}</span>
                  <span className={`chip ${c.poc_level === "decision_maker" ? "chip-ok" : "chip-yours"}`} style={{ marginLeft: "auto" }}>
                    {LEVEL[c.poc_level]}
                    {c.relevant ? " · logistics/B2B focus" : ""}
                  </span>
                </div>
                {(c.focus || c.bio) && <p className="reason" style={{ fontSize: 14, lineHeight: "20px" }}>{c.focus || c.bio}</p>}
                <div className="row-foot">
                  {c.linkedin_url && (
                    <a className="chip chip-src" href={c.linkedin_url} target="_blank" rel="noopener noreferrer">
                      LinkedIn <ExternalLink size={12} aria-hidden />
                    </a>
                  )}
                  {c.x_url && (
                    <a className="chip chip-src" href={c.x_url} target="_blank" rel="noopener noreferrer">
                      X <ExternalLink size={12} aria-hidden />
                    </a>
                  )}
                  {c.email && (
                    <a className="chip chip-src" href={`mailto:${c.email}`}>
                      <AtSign size={12} aria-hidden /> {c.email}
                    </a>
                  )}
                  <a className="chip chip-src" href={c.source_url} target="_blank" rel="noopener noreferrer">
                    Source <ExternalLink size={12} aria-hidden />
                  </a>
                  {c.messages.length > 0 && (
                    <button type="button" className="btn action" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>
                      {open === c.id ? "Hide drafts" : "Show drafts"}
                    </button>
                  )}
                </div>
                {open === c.id &&
                  c.messages.map((m) => (
                    <div key={m.kind} className="panel" style={{ marginTop: 10 }}>
                      <p className="meta" style={{ margin: 0 }}>
                        {KIND[m.kind]}
                        {m.subject ? `: ${m.subject}` : ""}
                      </p>
                      <p style={{ whiteSpace: "pre-wrap", margin: "8px 0", maxWidth: "62ch" }}>{m.body}</p>
                      <div className="row-foot" style={{ marginTop: 0 }}>
                        <CopyButton text={m.subject ? `Subject: ${m.subject}\n\n${m.body}` : m.body} label={`Copy ${KIND[m.kind].toLowerCase()}`} done={`${KIND[m.kind]} copied`} />
                        {m.kind !== "linkedin_note" && to && (
                          <a className="btn" href={mailto(to, m.subject, m.body)}>
                            <Mail size={14} aria-hidden /> Open in email
                          </a>
                        )}
                        {m.kind === "linkedin_note" && c.linkedin_url && (
                          <a className="btn" href={c.linkedin_url} target="_blank" rel="noopener noreferrer">
                            Open LinkedIn <ExternalLink size={14} aria-hidden />
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
      <p className="meta" style={{ marginTop: 8 }}>
        Drafts use only the firm&apos;s own site and the dated signals above. Fill the [bracketed] parts in data/founder.json. Nothing is sent from this page.
      </p>
    </section>
  );
}
