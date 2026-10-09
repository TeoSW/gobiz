import { useQueryClient } from "@tanstack/react-query";
import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ro" | "en";
export const LANGS: Lang[] = ["ro", "en"];
const KEY = "skillsync-lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "ro" || saved === "en") return saved;
  } catch {
    /* storage unavailable */
  }
  return navigator.language?.toLowerCase().startsWith("ro") ? "ro" : "en";
}

let current: Lang = initialLang();

/** Current language for code outside React components (API header, date and number formatting). */
export const getLang = () => current;

/**
 * Texts of one component in both languages. TypeScript checks that the Romanian object has exactly the
 * same keys (and function signatures) as the English one, so a missing translation is a build error.
 */
export function texts<T>(en: T, ro: NoInfer<T>): Record<Lang, T> {
  return { en, ro };
}

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: current, setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [lang, setLangState] = useState<Lang>(current);
  current = lang;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === "ro" ? "SkillSync · Match făcut. Proiect început." : "SkillSync · Match made. Project started.";
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* per-viewer convenience only */
    }
  }, [lang]);

  const setLang = (l: Lang) => {
    current = l;
    setLangState(l);
    qc.invalidateQueries(); // texts made by the API (match explanations, skill names) come in the new language
  };

  // remounting on a language switch re-renders every text, including those formatted outside hooks
  return (
    <Ctx.Provider value={{ lang, setLang }}>
      <Fragment key={lang}>{children}</Fragment>
    </Ctx.Provider>
  );
}

export const useLang = () => useContext(Ctx);

export function useTexts<T>(t: Record<Lang, T>): T {
  return t[useContext(Ctx).lang];
}

/** Romanian plural: 1 proiect, 2 proiecte, 20 de proiecte. */
export function roPlural(n: number, one: string, few: string) {
  if (n === 1) return `1 ${one}`;
  const mod = n % 100;
  return n === 0 || (mod >= 1 && mod <= 19) ? `${n} ${few}` : `${n} de ${few}`;
}
