import { ArrowDown, Bot, Brain, Filter, Heart, ListOrdered, MessageSquareText, Network, Scale } from "lucide-react";

const STEPS = [
  {
    icon: Bot,
    title: "1 · The LLM reads the company's text",
    text: "A local open-source model (Qwen3 via Ollama, structured JSON output) turns free text into tasks, explicitly mentioned skills, suggested skills and missing information. A rule-based pass then checks it: required/optional comes from the actual wording, and skills named in the text but skipped by the model are added back. Skill names are normalised to a shared catalog (ESCO-inspired). An 'explicit' skill whose quote cannot be found in the text is downgraded to a suggestion, and suggestions are never mandatory. The company confirms everything.",
  },
  {
    icon: Filter,
    title: "2 · Hard filters first",
    text: "Opportunity type, hours per week, availability period, work mode and required skills. A clear mismatch makes the pair incompatible; missing information marks it 'to clarify'. A very similar description can never compensate for being unavailable.",
  },
  {
    icon: Scale,
    title: "3 · Weighted, explainable score",
    text: "score = 50% skills + 25% relevant experience + 15% interests & goals + 10% description similarity. Skills distinguish 'knows' from 'wants to learn': a requirement the company marks as learnable gives partial credit to a student who wants to learn it; related skills give a little credit.",
  },
  {
    icon: Brain,
    title: "4 · Semantic similarity",
    text: "paraphrase-multilingual-MiniLM-L12-v2 (sentence-transformers) embeds descriptions in Romanian or English. Texts are split into chunks under the model's 128-token limit and compared with cosine similarity; vectors are cached and recomputed only when a description changes.",
  },
  {
    icon: ListOrdered,
    title: "5 · Ranking + explanation",
    text: "Results are sorted (incompatible last) and shown with ✓/✗ per skill, checks and a plain-language summary. The score orders options; it is not a probability of success.",
  },
  {
    icon: Heart,
    title: "6 · Swipe to match",
    text: "The ranked list becomes a card deck. Students swipe opportunities, companies swipe students (clear mismatches are left out). A right swipe stays private until the other side also swipes right: then it's a match and the chat opens. Applying counts as the student's yes and inviting as the company's, so swipes and the classic buttons work together. A match is a recommendation that both people accepted, not a hiring decision: the company still selects who does the work.",
  },
  {
    icon: Network,
    title: "7 · Learning later",
    text: "Every swipe, apply, invite, accept/decline, selection, completion and rating is logged. When enough real interactions exist, a learned ranker can be trained on them - starting rule-based avoids the cold-start problem. The optional Neo4j graph links students, skills and opportunities for analytics.",
  },
];

export default function About() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">How matching works</h1>
        <p className="mt-2 text-muted-fg">
          A content-based recommender combining an LLM, explicit skill matching and semantic search. It recommends; students and companies decide.
        </p>
      </div>
      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <div className="card flex gap-4 p-5">
              <s.icon className="size-6 shrink-0 text-primary-strong" aria-hidden />
              <div>
                <h2 className="font-bold">{s.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-fg">{s.text}</p>
              </div>
            </div>
            {i < STEPS.length - 1 && <ArrowDown className="mx-auto my-1 size-4 text-muted-fg" aria-hidden />}
          </li>
        ))}
      </ol>
      <div className="card flex gap-3 p-5 text-sm">
        <MessageSquareText className="size-5 shrink-0 text-accent" aria-hidden />
        <p>
          Evaluation: <code className="rounded bg-muted px-1">python -m scripts.evaluate_matching</code> compares the engine with a skills-only and a semantic-only baseline (precision@5,
          recall@5, MRR) on manually labelled pairs.
        </p>
      </div>
    </div>
  );
}
