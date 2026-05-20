export type UploadProgressState = {
  status: "idle" | "uploading" | "success" | "error";
  progress: number;
  filename: string;
  message: string;
};

export type UploadResponse = {
  ok: boolean;
  message?: string;
  asset?: {
    url: string;
  };
};

export function emptyUploadProgress(): UploadProgressState {
  return {
    status: "idle",
    progress: 0,
    filename: "",
    message: ""
  };
}

export function uploadImageFile(
  file: File,
  onProgress: (state: UploadProgressState) => void
): Promise<UploadResponse> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    onProgress({
      status: "uploading",
      progress: 0,
      filename: file.name,
      message: "正在准备上传..."
    });

    xhr.upload.onprogress = (event) => {
      const progress = event.lengthComputable && event.total > 0
        ? Math.min(99, Math.round((event.loaded / event.total) * 100))
        : 0;

      onProgress({
        status: "uploading",
        progress,
        filename: file.name,
        message: progress ? `正在上传 ${progress}%` : "正在上传..."
      });
    };

    xhr.onload = () => {
      let result: UploadResponse = { ok: false, message: "上传失败。" };
      try {
        result = JSON.parse(xhr.responseText || "{}") as UploadResponse;
      } catch {
        result = { ok: false, message: "服务端返回了无效的上传响应。" };
      }

      if (xhr.status >= 200 && xhr.status < 300 && result.ok && result.asset?.url) {
        onProgress({
          status: "success",
          progress: 100,
          filename: file.name,
          message: "上传完成。"
        });
        resolve(result);
        return;
      }

      onProgress({
        status: "error",
        progress: 100,
        filename: file.name,
        message: result.message || "上传失败。"
      });
      resolve({ ...result, ok: false, message: result.message || "上传失败。" });
    };

    xhr.onerror = () => {
      const result = { ok: false, message: "上传时发生网络错误。" };
      onProgress({
        status: "error",
        progress: 100,
        filename: file.name,
        message: result.message
      });
      resolve(result);
    };

    xhr.onabort = () => {
      const result = { ok: false, message: "上传已取消。" };
      onProgress({
        status: "error",
        progress: 100,
        filename: file.name,
        message: result.message
      });
      resolve(result);
    };

    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  });
}
