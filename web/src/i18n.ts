import i18n, { BackendModule, FallbackLng, FallbackLngObjList } from "i18next";
import { orderBy } from "lodash-es";
import { initReactI18next } from "react-i18next";
import { findNearestMatchedLanguage } from "./utils/i18n";

export const locales = orderBy(["en", "zh-Hans"]);

const fallbacks = {
  zh: ["zh-Hans", "en"],
} as FallbackLngObjList;

const LazyImportPlugin: BackendModule = {
  type: "backend",
  init: function () {},
  read: function (language, _, callback) {
    const matchedLanguage = findNearestMatchedLanguage(language);
    import(`./locales/${matchedLanguage}.json`)
      .then((translationModule: Record<string, unknown>) => {
        callback(null, (translationModule.default as Record<string, unknown>) ?? translationModule);
      })
      .catch(() => {
        import("./locales/en.json")
          .then((translationModule: Record<string, unknown>) => {
            callback(null, (translationModule.default as Record<string, unknown>) ?? translationModule);
          })
          .catch((error: unknown) => {
            callback(error as Error, false);
          });
      });
  },
};

i18n
  .use(LazyImportPlugin)
  .use(initReactI18next)
  .init({
    detection: {
      order: ["navigator"],
    },
    interpolation: {
      escapeValue: false,
    },
    fallbackLng: {
      ...fallbacks,
      ...{ default: ["en"] },
    } as FallbackLng,
  });

export default i18n;
export type TLocale = (typeof locales)[number];
