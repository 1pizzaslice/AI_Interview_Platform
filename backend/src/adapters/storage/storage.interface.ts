export interface UploadResult {
  key: string;
  url: string;
  sizeBytes: number;
}

export interface IStorageAdapter {
  upload(buffer: Buffer, key: string, mimeType: string): Promise<UploadResult>;
  getUrl(key: string): string;
  delete(key: string): Promise<void>;
}
