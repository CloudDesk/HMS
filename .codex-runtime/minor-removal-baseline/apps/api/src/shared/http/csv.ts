import { Readable } from 'node:stream';

export type CsvValue = Date | boolean | number | string | null | undefined;

const csvCell = (value: CsvValue) => {
  const formatted = value instanceof Date ? value.toISOString() : String(value ?? '');
  return `"${formatted.replaceAll('"', '""')}"`;
};

export const createCsvStream = (headers: string[], rows: AsyncIterable<CsvValue[]>) =>
  Readable.from(
    (async function* () {
      yield `${headers.map(csvCell).join(',')}\r\n`;
      for await (const row of rows) {
        yield `${row.map(csvCell).join(',')}\r\n`;
      }
    })(),
  );
