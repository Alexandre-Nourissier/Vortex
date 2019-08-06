import { log } from './log';

import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';

async function readHashList(basePath: string): Promise<{ [name: string]: string }> {
  const data = await fs.readFile(path.join(basePath, 'md5sums.csv'), { encoding: 'utf-8' });
  return data.split('\n')
    .reduce((prev, line) => {
      const [ key, hash ] = line.split(':');
      prev[key] = hash;
      return prev;
    }, {});
}

async function hashFile(fullPath: string): Promise<string> {
  const hash = crypto.createHash('md5');
  const fileData: Buffer = await fs.readFile(fullPath);
  const buf = hash
    .update(fileData)
    .digest();
  return buf.toString('hex');
}

export async function validateFiles(basePath: string)
    : Promise<{ missing: string[], changed: string[] }> {
  let fileList = {};
  try {
    fileList = await readHashList(basePath);
  } catch (err) {
    // nop
    log('info', 'not validating vortex files', err.message);
  }

  const result: {
    missing: string[],
    changed: string[],
   } = { missing: [], changed: [] };

  return Promise.all(Object.keys(fileList)
    .map(async fileName => {
      try {
        const hash = await hashFile(path.join(basePath, fileName));
        if (hash !== fileList[fileName]) {
          result.changed.push(fileName);
        }
      } catch (err) {
        result.missing.push(fileName);
      }
    }))
    .then(() => result);
}
