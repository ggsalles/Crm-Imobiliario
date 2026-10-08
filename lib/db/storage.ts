import { apiClient } from '../api-client';
import { optimizeImageForUpload } from '../image-optimizer';
import { getSafeSession } from './core';

export async function uploadFile(file: File, bucketName: string = 'property-images', bypassUserId?: string) {
  try {
    let userId = bypassUserId;

    if (!userId) {
      const session = await getSafeSession();
      userId = session?.user?.id;
      
      if (!userId) {
        userId = "anonymous";
      }
    }

    const processedFile = await optimizeImageForUpload(file);
    const formData = new FormData();
    formData.append("file", processedFile);
    formData.append("bucketName", bucketName);
    formData.append("userId", userId || "anonymous");

    console.log(`[Storage Client] Redirecionando upload de "${processedFile.name}" para proxy de API local...`);

    const result = await apiClient.post<any>("/api/upload", formData, { timeout: 60000 });
    return { name: result.name, url: result.url };
  } catch (err: any) {
    console.error("[Storage] Falha crítica no uploadFile através do Proxy:", err);
    throw err;
  }
}

export async function uploadChatFile(file: File) {
  return uploadFile(file, 'chat-attachments');
}

export async function downloadFile(url: string, fileName: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("Error downloading file:", error);
    window.open(url, '_blank');
  }
}
