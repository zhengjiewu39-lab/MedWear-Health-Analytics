import React, {
  createContext, useContext, useState, useCallback, useMemo,
} from 'react';

const STORAGE_KEY = 'medwear_lang';
const LanguageContext = createContext(null);

/** @returns {'zh'|'en'} */
function readInitialLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') return stored;
  } catch {
    /* ignore */
  }
  return 'zh';
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readInitialLang);

  const setLang = useCallback((next) => {
    const l = next === 'en' ? 'en' : 'zh';
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
    setLangState(l);
    try {
      document.documentElement.lang = l === 'en' ? 'en' : 'zh-CN';
    } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    setLang(lang === 'zh' ? 'en' : 'zh');
  }, [lang, setLang]);

  /**
   * Inline bilingual helper.
   * @param {string} zh Chinese text (default / source of truth)
   * @param {string} [en] English text; falls back to zh when missing
   * @returns {string}
   */
  const t = useCallback((zh, en) => {
    if (lang === 'en' && en != null && en !== '') return en;
    return zh;
  }, [lang]);

  const value = useMemo(() => ({
    lang,
    isEn: lang === 'en',
    setLang,
    toggle,
    t,
  }), [lang, setLang, toggle, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}

export default LanguageContext;
