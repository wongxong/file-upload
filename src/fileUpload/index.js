import Worker from "./worker.js?worker";
import { mapLimit, ajax } from "./utils";

class FileObject {
  constructor({ file, index, start, end, option }) {
    this.option = option;
    this.file = file;
    this.index = index;
    this.start = start;
    this.end = end;
    this.size = this.file.size;
    this.name = this.option.file.name + '_' + index;
    this.type = this.option.file.type;
    this.retryCount = option.retryCount;
    this.status = "waiting";
    this._retryTimer = null;
    this._xhr = null;
    this._p = null; // Promise
  }

  upload() {
    if (this._p) return this._p;

    const p = new Promise((resolve, reject) => {
      this.status = "uploading";
      this.retryCount = this.option.retryCount;
      this._doUpload(resolve, reject);
    }).finally(() => {
      this._p = null;
    });

    this._p = p;

    return p;
  }

  _doUpload(resolve, reject) {
    this._xhr = ajax({
      url: this.option.url,
      method: this.option.method,
      headers: this.option.headers,
      query: this.option.query,
      data: this.option.data,
      file: this.file,
      fileKey: this.option.fileKey,
      onProgress: this.option.onProgress,
      onSuccess: res => {
        this._xhr = null;
        this.changeStatus("success");
        this.option.onSuccess && this.option.onSuccess(res, this);
        resolve(res);
      },
      onError: err => {
        if (this.retryCount > 0) {
          this.retryCount--;
          this._retryTimer = setTimeout(() => {
            this._retryTimer = null;
            this._doUpload(resolve, reject);
          }, this.option.retryDelay);
        } else {
          this._xhr = null;
          this.changeStatus("error");
          this.option.onError && this.option.onError(err, this);
          reject(err);
        }
      },
      onCancel: err => {
        this._xhr = null;
        this.option.onCancel && this.option.onCancel(err, this);
        reject(err);
      },
    });
  }

  changeStatus(status) {
    this.status = status;
    this.option.onUpdateStatus && this.option.onUpdateStatus(status, this);
  }

  cancel() {
    if (this.status !== "uploading") return;

    this.changeStatus("canceled");
    this._p = null;

    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }

    if (this._xhr) {
      this._xhr.abort();
      this._xhr = null;
    }
  }
}

class UploadClient {
  constructor(option) {
    this.option = {
      url: "",
      method: "POST",
      headers: {},
      query: null,
      file: null,
      fileKey: "file", // 文件字段名
      data: null,
      beforeUpload: null,
      beforeUploadItem: null,
      onSuccess: null,
      onError: null,
      onProgress: null,
      onCancel: null,
      onComplete: null,
      onUpdateStatus: null, // 文件状更新化时执行
      onUpdateHash: null, // 文件hash更新时执行
      retryDelay: 1000, // 重试间隔
      retryCount: 3, // 默认重试3次
      chunkSize: 0, // 默认不分片
      parallel: 3, // 默认并发3个
      ...option,
    };

    this.fileObjects = this.sliceFile(this.option.file);

  }

  createChunk(file, index, chunkSize) {
    const start = index * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const blob = file.slice(start, end);
    
    return {
      file: blob,
      index,
      start,
      end,
      hash: "",
    };
  }

  sliceFile(file) {
    const chunks = [];
    const chunkSize = this.option.chunkSize === 0 ? file.size : this.option.chunkSize;
    const chunkCount = Math.ceil(file.size / chunkSize);

    for (let i = 0; i < chunkCount; i++) {
      chunks.push(this.createChunk(file, i, chunkSize));
    }

    return chunks.map(chunk => new FileObject({
      ...chunk,
      option: this.option,
    }));
  }

  computedHash() {
    return new Promise(resolve => {
      const hashMap = {};
      const threadCount = navigator.hardwareConcurrency || 4; // 获取cpu核心数，默认4个
      const threadChunkCount = Math.ceil(this.fileObjects.length / threadCount); // 每个线程处理的分片数
  
      let finishedCount = 0;
  
      for (let i = 0; i < threadCount; i++) {
        // 开启一个线程任务
        const worker = new Worker();
        const start = i * threadChunkCount;
        const end = Math.min(start + threadChunkCount, this.fileObjects.length);
        worker.postMessage({
          chunks: this.fileObjects.slice(start, end).map(fileObject => {
            return {
              file: fileObject.file,
              index: fileObject.index,
            };
          }),
        }); // 发送消息给worker
        worker.onmessage = e => {
          worker.terminate(); // 关闭worker
          e.data.forEach(item => {
            hashMap[item.index] = item.hash;
          });
          this.fileObjects = this.fileObjects.map(fileObject => {
            fileObject.hash = hashMap[fileObject.index];
            return fileObject;
          });
          this.option.onUpdateHash && this.option.onUpdateHash();
          finishedCount += 1;

          if (finishedCount === threadCount) {
            this.option.onUpdateHash && this.option.onUpdateHash(true);
            resolve();
          }
        }
      }
    });
  }

  async upload() {    
    if (this.option.beforeUpload) {
      const bool = await this.option.beforeUpload(this.option.file, this);
      if (bool === false) return;
    }
    await mapLimit(this.fileObjects, { limit: this.option.parallel }, async fileObject => {
      if (this.option.beforeUploadItem) {
        const bool = await this.option.beforeUploadItem(fileObject.file, fileObject, this);
        if (bool === false) return;
      }
      await fileObject.upload();
    });
  }

  cancel() {
    this.fileObjects.forEach(fileObject => fileObject.cancel());
  }
}

async function createUploadClient(option) {
  const client = new UploadClient(option);
  client.computedHash();
  return client;
}

export default {
  createUploadClient,
  
  async put(option) {
    const client = await createUploadClient(option);
    client.upload();
  },

  async multipartUpload(option) {
    option = {
      chunkSize: 1024 * 1024 * 5, // 5MB
      async beforeUpload(file) {
        console.log("beforeUpload");
      }, // 上传前
      onError(err) {
        console.error('???')
      },
      ...option,
    };
    const client = await createUploadClient(option);
    client.upload();
  }
};