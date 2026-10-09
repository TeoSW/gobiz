import { ArrowDown, Bot, Brain, Filter, Heart, ListOrdered, MessageSquareText, Network, Scale } from "lucide-react";
import type { ReactNode } from "react";
import { texts, useTexts } from "../lib/i18n";

const ICONS = [Bot, Filter, Scale, Brain, ListOrdered, Heart, Network];

const T = texts(
  {
    title: "How matching works",
    intro: "A content-based recommender combining an LLM, explicit skill matching and semantic search. It recommends; students and companies decide.",
    steps: [
      {
        title: "1 · The LLM reads the company's text",
        text: "A local open-source model (Qwen3 via Ollama, structured JSON output) turns free text into tasks, explicitly mentioned skills, suggested skills and missing information. A rule-based pass then checks it: required/optional comes from the actual wording, and skills named in the text but skipped by the model are added back. Skill names are normalised to a shared catalog (ESCO-inspired). An 'explicit' skill whose quote cannot be found in the text is downgraded to a suggestion, and suggestions are never mandatory. The company confirms everything.",
      },
      {
        title: "2 · Hard filters first",
        text: "Opportunity type, hours per week, availability period, work mode and required skills. A clear mismatch makes the pair incompatible; missing information marks it 'to clarify'. A very similar description can never compensate for being unavailable.",
      },
      {
        title: "3 · Weighted, explainable score",
        text: "score = 50% skills + 25% relevant experience + 15% interests & goals + 10% description similarity. Skills distinguish 'knows' from 'wants to learn': a requirement the company marks as learnable gives partial credit to a student who wants to learn it; related skills give a little credit.",
      },
      {
        title: "4 · Semantic similarity",
        text: "paraphrase-multilingual-MiniLM-L12-v2 (sentence-transformers) embeds descriptions in Romanian or English. Texts are split into chunks under the model's 128-token limit and compared with cosine similarity; vectors are cached and recomputed only when a description changes.",
      },
      {
        title: "5 · Ranking + explanation",
        text: "Results are sorted (incompatible last) and shown with ✓/✗ per skill, checks and a plain-language summary. The score orders options; it is not a probability of success.",
      },
      {
        title: "6 · Swipe to match",
        text: "The ranked list becomes a card deck. Students swipe opportunities, companies swipe students (clear mismatches are left out). A right swipe stays private until the other side also swipes right: then it's a match and the chat opens. Applying counts as the student's yes and inviting as the company's, so swipes and the classic buttons work together. A match is a recommendation that both people accepted, not a hiring decision: the company still selects who does the work.",
      },
      {
        title: "7 · Learning later",
        text: "Every swipe, apply, invite, accept/decline, selection, completion and rating is logged. When enough real interactions exist, a learned ranker can be trained on them - starting rule-based avoids the cold-start problem. The optional Neo4j graph links students, skills and opportunities for analytics.",
      },
    ],
    evaluation: (code: ReactNode): ReactNode => (
      <>
        Evaluation: {code} compares the engine with a skills-only and a semantic-only baseline (precision@5, recall@5, MRR) on manually labelled pairs.
      </>
    ),
  },
  {
    title: "Cum funcționează potrivirea",
    intro: "Un sistem de recomandare bazat pe conținut, care combină un LLM, potrivirea explicită a abilităților și căutarea semantică. El recomandă; studenții și firmele decid.",
    steps: [
      {
        title: "1 · LLM-ul citește textul firmei",
        text: "Un model open source rulat local (Qwen3 prin Ollama, cu răspuns JSON structurat) transformă textul liber în sarcini, abilități menționate explicit, abilități sugerate și informații lipsă. Apoi un set de reguli îl verifică: „obligatoriu” sau „opțional” se stabilește din formularea reală, iar abilitățile numite în text, dar sărite de model, sunt adăugate înapoi. Numele abilităților sunt aduse la un catalog comun (inspirat din ESCO). O abilitate „explicită” al cărei citat nu apare în text devine sugestie, iar sugestiile nu sunt niciodată obligatorii. Firma confirmă totul.",
      },
      {
        title: "2 · Întâi filtrele stricte",
        text: "Tipul oportunității, orele pe săptămână, perioada de disponibilitate, modul de lucru și abilitățile obligatorii. O nepotrivire clară face perechea incompatibilă; informațiile lipsă o marchează „de clarificat”. O descriere foarte asemănătoare nu poate compensa faptul că studentul nu e disponibil.",
      },
      {
        title: "3 · Scor ponderat și explicabil",
        text: "scor = 50% abilități + 25% experiență relevantă + 15% interese și obiective + 10% asemănarea descrierilor. Abilitățile deosebesc „știe” de „vrea să învețe”: o cerință pe care firma o marchează ca „se poate învăța” dă punctaj parțial unui student care vrea să o învețe; abilitățile înrudite dau puțin punctaj.",
      },
      {
        title: "4 · Similaritate semantică",
        text: "paraphrase-multilingual-MiniLM-L12-v2 (sentence-transformers) transformă descrierile în română sau engleză în vectori. Textele sunt împărțite în bucăți sub limita de 128 de tokeni a modelului și comparate prin similaritate cosinus; vectorii sunt păstrați și recalculați doar când se schimbă descrierea.",
      },
      {
        title: "5 · Ordonare și explicație",
        text: "Rezultatele sunt ordonate (cele incompatibile la final) și afișate cu ✓/✗ pentru fiecare abilitate, verificări și un rezumat în cuvinte simple. Scorul ordonează opțiunile; nu este o probabilitate de succes.",
      },
      {
        title: "6 · Swipe pentru match",
        text: "Lista ordonată devine un pachet de carduri. Studenții dau swipe pe oportunități, firmele pe studenți (nepotrivirile clare nu apar). Un swipe la dreapta rămâne privat până când și cealaltă parte dă swipe la dreapta: atunci e match și se deschide chatul. Aplicarea contează ca „da” din partea studentului, iar invitația ca „da” din partea firmei, așa că swipe-urile și butoanele clasice merg împreună. Un match e o recomandare acceptată de ambele părți, nu o angajare: firma alege în continuare cine face lucrarea.",
      },
      {
        title: "7 · Învățare mai târziu",
        text: "Fiecare swipe, aplicare, invitație, acceptare sau refuz, selecție, finalizare și notă este înregistrată. Când vor exista destule interacțiuni reale, se poate antrena un model de ordonare pe ele - pornirea pe reguli evită problema lipsei de date la început. Graful Neo4j opțional leagă studenți, abilități și oportunități pentru analize.",
      },
    ],
    evaluation: (code) => (
      <>
        Evaluare: {code} compară motorul cu o variantă doar pe abilități și una doar semantică (precision@5, recall@5, MRR), pe perechi etichetate manual.
      </>
    ),
  },
);

export default function About() {
  const t = useTexts(T);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">{t.title}</h1>
        <p className="mt-2 text-muted-fg">{t.intro}</p>
      </div>
      <ol className="space-y-3">
        {t.steps.map((s, i) => {
          const Icon = ICONS[i];
          return (
            <li key={s.title}>
              <div className="card flex gap-4 p-5">
                <Icon className="size-6 shrink-0 text-primary-strong" aria-hidden />
                <div>
                  <h2 className="font-bold">{s.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-fg">{s.text}</p>
                </div>
              </div>
              {i < t.steps.length - 1 && <ArrowDown className="mx-auto my-1 size-4 text-muted-fg" aria-hidden />}
            </li>
          );
        })}
      </ol>
      <div className="card flex gap-3 p-5 text-sm">
        <MessageSquareText className="size-5 shrink-0 text-accent" aria-hidden />
        <p>{t.evaluation(<code className="rounded bg-muted px-1">python -m scripts.evaluate_matching</code>)}</p>
      </div>
    </div>
  );
}
