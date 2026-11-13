/** Translator used on the server and in client components. Client-safe, no dependencies besides React. */
import { createElement, Fragment, type ReactNode } from "react";
import type { Locale } from "./config";
import type { MessageKey, Messages } from "./messages/en";

export type Params = Record<string, string | number>;

const PLACEHOLDER = /\{(\w+)\}/g;

/** Names of the {placeholders} in a template. */
export function placeholders(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((m) => m[1]).sort();
}

/** "Hello {name}" + { name: "Ana" } → "Hello Ana". Unknown placeholders are left as they are. */
export function interpolate(template: string, params: Params = {}): string {
  return template.replace(PLACEHOLDER, (match, key: string) => (key in params ? String(params[key]) : match));
}

export interface Translator {
  locale: Locale;
  /** Translated plain text. */
  t: (key: MessageKey, params?: Params) => string;
  /** Translated text with React elements (e.g. links) in place of {placeholders}. */
  rich: (key: MessageKey, params: Record<string, ReactNode>) => ReactNode;
}

export function createTranslator(locale: Locale, messages: Messages): Translator {
  // An unknown key (e.g. a new AI tool name) shows the key itself instead of crashing.
  const template = (key: MessageKey) => messages[key] ?? key;
  return {
    locale,
    t: (key, params) => interpolate(template(key), params),
    rich: (key, params) =>
      template(key)
        .split(PLACEHOLDER)
        // split() with a capture group alternates text, placeholder name, text, …
        .map((part, i) => createElement(Fragment, { key: i }, i % 2 === 1 && part in params ? params[part] : part)),
  };
}
