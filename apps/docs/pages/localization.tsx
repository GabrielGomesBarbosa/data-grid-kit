import LocalizationDemo from '../demos/LocalizationDemo'
import localizationSrc from '../demos/LocalizationDemo.tsx?raw'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'localization',
  group: 'Main features',
  title: 'Localization',
  intro: 'Every text the grid shows can be replaced, and numbers and dates can be written in the locale you choose.',
  body: () => (
    <>
      {demo('LocalizationDemo', LocalizationDemo, localizationSrc)}
      <h2>The texts</h2>
      <ul>
        <li>
          <code>localeText</code> is an object with the keys you want to change (<code>GridLocaleText</code> lists them all). What you leave out stays in
          English, so you can translate the grid one screen at a time.
        </li>
        <li>
          A key holds a string, or a <strong>function</strong> when the text has a name or a number in it:{' '}
          <code>pivotMoveUp: (field) =&gt; …</code>, <code>footerRows: (count, hasMore, formatted) =&gt; …</code>. The word order is yours, and the
          functions fit <code>intl.formatMessage</code> of react-intl or next-intl as they are.
        </li>
        <li>
          Ready-made packs live in <code>data-grid-kit/locales</code> (<code>ptBR</code> for now). A pack is <code>{'{ locale, localeText }'}</code>: spread it
          (<code>{'<Grid {...ptBR} />'}</code>) or take <code>ptBR.localeText</code> and change a key.
        </li>
        <li>
          <strong>Keep the object the same between renders</strong>: define it outside the component, or <code>useMemo</code> it. A new object (or new
          functions) re-renders the grid.
        </li>
        <li>
          From a Next.js Server Component you cannot pass functions to the grid: set <code>localeText</code> in a Client Component (a file with{' '}
          <code>'use client'</code>) that renders the grid.
        </li>
        <li>
          The toolbar parts keep their <code>label</code> prop (<code>{'<ColumnsButton label="…" />'}</code>); without it they use the dictionary. In your own slots,{' '}
          <code>useLocaleText()</code> gives the texts and the locale of the grid around them.
        </li>
      </ul>
      <h2>Numbers and dates</h2>
      <ul>
        <li>
          <code>locale</code> (<code>'pt-BR'</code>) is used for dates in cells, groups and the Excel export, and for aggregates, the total row and the
          counts in the footer. Without it the browser's locale is used, as before.
        </li>
        <li>
          A number cell shows the value as it is. To write it in a locale, give the column a <code>valueFormatter</code>.
        </li>
        <li>
          Sorting, filtering and the quick search keep using the browser's locale (and the text of a date as the browser writes it), so what they find does not
          depend on a prop.
        </li>
        <li>
          Not translated: the text of your own data, a custom aggregation's <code>label</code>, the headers you write, and the sheet and file names.
        </li>
      </ul>
    </>
  ),
}
