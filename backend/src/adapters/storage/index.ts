import { config } from '../../config';
import type { IStorageAdapter } from './storage.interface';
import { LocalStorageAdapter } from './local-storage.adapter';
import { S3StorageAdapter } from './s3-storage.adapter';

let instance: IStorageAdapter | null = null;

export function createStorageAdapter(): IStorageAdapter {
  if (instance) return instance;

  if (config.STORAGE_PROVIDER === 's3') {
    instance = new S3StorageAdapter();
  } else {
    instance = new LocalStorageAdapter();
  }

  return instance;
}

export type { IStorageAdapter, UploadResult } from './storage.interface';
