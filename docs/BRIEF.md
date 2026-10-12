# Client Brief: VC Fundraising Pipeline Intelligence

Source: MESA Cohort C4, AI and its Applications, Section 1 Final Examination, Problem Statement 10 (High Difficulty).

## Submission constraints
- Use live external data wherever possible. The system must work with some data at the time of submission.
- All AI tasks must use **Gemini Flash**. Do not use the Claude API.
- Deploy on **Vercel**. Submit a working public URL, the GitHub repository link, and the Components Map.

## The client
Vikram is a first-time founder raising a Seed round for his B2B logistics SaaS. He has been fundraising for two months and tracks about fifty VCs: name, firm, thesis, the last time they were in contact, and whether he is waiting for a response or has yet to reach out. He keeps this in a manual spreadsheet that doesn't tell him the most important thing: who is worth reaching out to right now.

## What counts as a signal
A VC is worth contacting when there is an observable signal that they are actively thinking about his space, for example:
- a blog post about supply chain tech
- a new portfolio investment in a logistics company
- speaking at an industry event
- something said in an interview

A VC who has been quiet for three months is probably not the right one to chase this week.

## Requirements
1. Twice a week, before he starts working his pipeline, Vikram wants to know which VCs on his list are worth reaching out to **this week, and why**. The reason must be an actual, observable signal from the **past thirty days**: something they wrote, said in an interview, invested in, or appeared at. Not a hunch.
2. For VCs who have been **quiet**, he wants to know that too, so he knows where not to spend energy right now.
3. Every time the system runs, his **Supabase table** should reflect the current state of each relationship, so his pipeline is already up to date when he opens it.
4. **Critical:** the system must not overwrite Vikram's manual notes. It should update only the signal-derived columns:
   - last signal date
   - signal summary
   - follow-up score
   - recommended action

   Vikram's **contact history** and **personal notes** columns must remain untouched.

Build and deploy this VC pipeline intelligence system for Vikram.
