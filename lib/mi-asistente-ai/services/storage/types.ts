export type UploadInput = {
  chatId: string;
  fileName: string;
  buffer: Buffer;
  contentType: string;
};

export type UploadResult = {
  provider: string;
  path: string;
  url?: string | null;
  message: string;
};

export type StorageAdapter = {
  id: string;
  label: string;
  isConfigured: () => boolean;
  upload: (input: UploadInput) => Promise<UploadResult>;
};
