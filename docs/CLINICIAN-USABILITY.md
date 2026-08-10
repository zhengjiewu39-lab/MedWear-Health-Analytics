# Clinician Usability Study — Future Work Template

> **Status:** Planned future work — not conducted. This document provides templates only.  
> **Product positioning:** Research prototype / non-medical device — do not use outputs for clinical decisions without validation.

---

## 1. Study Objectives (draft)

- Assess whether physicians can interpret BHI watch tiers, threshold alerts, and evidence-linked screening outputs.
- Evaluate trust, perceived utility, and workflow fit for **decision support** (not autonomous diagnosis).
- Identify privacy concerns with local-first Apple Health import.

---

## 2. Semi-Structured Interview Guide (English)

### Opening (5 min)

- Role, specialty, years in practice, prior wearable/remote monitoring experience.
- Confirm informed consent and recording permission.

### Task walkthrough (20 min)

After a scripted demo of MedWear (demo mode, synthetic data labeled):

1. What does **BHI (behavioral health index)** mean to you? Is it distinct from disease risk?
2. How would you use **watch tiers** (Stable / Observe / Watch closely) in practice?
3. Are **evidence levels A/B/C** clear? Do you understand they are author annotations, not regulatory ratings?
4. Which outputs would you **never** act on without confirmatory testing?

### Trust & governance (10 min)

- Transparency of rule engine vs black-box ML — which do you prefer for audit?
- Comfort with local-only storage vs optional LLM summarization.
- What would you need before considering a pilot (IRB, SaMD pathway, etc.)?

### Closing (5 min)

- Single biggest barrier to adoption in your setting.
- Suggested improvements to doctor report / intervention approval flow.

---

## 3. Likert Questionnaire (1 = Strongly disagree · 5 = Strongly agree)

| # | Statement |
|---|-----------|
| Q1 | I understand that BHI is a behavioral wellness index, not a calibrated disease-risk score. |
| Q2 | The BHI watch tier labels (Stable / Observe / Watch closely) are clinically meaningful as **monitoring prompts**. |
| Q3 | Evidence A/B/C labels help me judge how much weight to give screening suggestions. |
| Q4 | I trust locally stored Apple Health data handling described in the app. |
| Q5 | I would require confirmatory clinical tests before acting on elevated screening probabilities. |
| Q6 | The rule-engine explanations are sufficient for professional review. |
| Q7 | I would recommend this tool for **research/education** contexts only. |
| Q8 | I would **not** use this tool as a standalone diagnostic device. |

Optional free text after each section.

---

## 4. Privacy & Informed Consent Template (draft)

**Study title:** Clinician usability of MedWear Health Analytics (research prototype)

**Purpose:** Evaluate interpretability and workflow fit of a local-first wearable analytics prototype. No patient care decisions will be made using study sessions.

**Data collected:** Interview audio (if consented), anonymized questionnaire responses, session notes. No real patient PHI in demo sessions.

**Storage:** De-identified transcripts stored on encrypted institutional storage for ≤3 years.

**Risks:** Minimal — discussion of hypothetical scenarios only.

**Voluntary participation:** You may withdraw at any time without penalty.

**Contact:** [Principal investigator name, email, IRB number — TBD]

```
Participant signature: ___________________  Date: __________
Investigator signature: __________________  Date: __________
```

---

## 5. Ethics Reminders

- Do **not** present MedWear as FDA/CE-marked or clinically validated.
- Use **demo/synthetic mode** unless IRB approves real PHI review.
- Report usability findings separately from benchmark performance metrics (`docs/EVALUATION.md`).

---

## 6. Planned Timeline (placeholder)

| Phase | Activity | Status |
|-------|----------|--------|
| T0 | IRB submission (if required) | Not started |
| T1 | Pilot n≈8–12 clinicians | Not started |
| T2 | Thematic analysis + SUS/Likert summary | Not started |
| T3 | Revise UI labels & methodology transparency | Not started |
