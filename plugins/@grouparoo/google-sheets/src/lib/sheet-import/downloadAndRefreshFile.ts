import { log } from "actionhero";
import fs from "fs-extra";
import path from "path";
import { tmpdir } from "os";
import { SimpleSourceOptions } from "@grouparoo/core";
import Spreadsheet from "./Spreadsheet";
import csvWriter from "csv-write-stream";

const CSV_CACHE_MILLISECONDS = 1000 * 60;

export async function downloadAndRefreshFile(
  sourceId: string,
  appOptions: SimpleSourceOptions,
  sourceOptions: SimpleSourceOptions
) {
  const sheet = new Spreadsheet(
    appOptions,
    sourceOptions.sheet_url?.toString()
  );

  let localDir = path.join(tmpdir(), "google-sheets-cache", sourceId);
  let localPath = path.join(localDir, `${sheet.docId}.csv`);

  let toDownload = false;
  if (!fs.existsSync(localPath)) {
    toDownload = true;
    fs.mkdirpSync(localDir);
  } else {
    const stats = fs.statSync(localPath);
    const now = new Date();
    if (now.getTime() - stats.birthtime.getTime() > CSV_CACHE_MILLISECONDS)
      toDownload = true;
  }

  if (toDownload) {
    log(`Saving Google Sheet to \`${localPath}\``, "debug");
    if (fs.existsSync(localPath)) fs.rmSync(localPath, { force: true });
    const writer = csvWriter({
      sendHeaders: true,
      headers: await sheet.getHeaders(),
    });
    writer.pipe(fs.createWriteStream(localPath));
    const limit = 900;
    let offset = 0;
    let rows = await sheet.read({ limit, offset });

    while (rows.length > 0) {
      for (const row of rows) {
        writer.write(row);
      }
      offset += limit;
      rows = await sheet.read({ limit, offset });
    }
    writer.end();
  }
  return localPath;
}