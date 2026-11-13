import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LOCALES } from "@/lib/i18n/config";
import { getI18n, getLocale } from "@/lib/i18n/page";
import { getMessages } from "@/lib/i18n/server";
import { I18nProvider } from "@/components/I18nProvider";
import "../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/** Every language is prerendered. */
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.title"), description: t("meta.description") };
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <I18nProvider locale={locale} messages={await getMessages(locale)}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
