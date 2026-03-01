import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config';
import type { IStorageAdapter, UploadResult } from './storage.interface';

export class LocalStorageAdapter implements IStorageAdapter {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.resolve(config.UPLOAD_DIR);
  }

  async upload(buffer: Buffer, key: string, _mimeType: string): Promise<UploadResult> {
    const filePath = path.join(this.uploadDir, key);
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, buffer);

    return {
      key,
      url: `/uploads/${key}`,
      sizeBytes: buffer.length,
    };
  }

  getUrl(key: string): string {
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.uploadDir, key);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }
}
