import type { IStorageAdapter, UploadResult } from './storage.interface';

/**
 * AWS S3 storage adapter stub — Phase 6+
 * Install @aws-sdk/client-s3 and implement when STORAGE_PROVIDER=s3
 */
export class S3StorageAdapter implements IStorageAdapter {
  constructor() {
    throw new Error('S3StorageAdapter not yet implemented. Set STORAGE_PROVIDER=local for now.');
  }

  async upload(_buffer: Buffer, _key: string, _mimeType: string): Promise<UploadResult> {
    throw new Error('Not implemented');
  }

  getUrl(_key: string): string {
    throw new Error('Not implemented');
  }

  async delete(_key: string): Promise<void> {
    throw new Error('Not implemented');
  }
}
