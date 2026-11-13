import { en } from "./messages/en";
import { createTranslator } from "./translate";

/** Default translator for code without a page language (cron job, CLI, tests). */
export const english = createTranslator("en", en);
