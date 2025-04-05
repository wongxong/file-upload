<template>
  <div class="file-picker-zone">
    <span>请点击选择文件</span>
    <input type="file" @change="handleFilePick">
  </div>
  <div>
    <table>
      <thead>
        <tr>
          <th>文件名</th>
          <th>类型</th>
          <th>hash</th>
          <th>大小</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, index) in fileList" :key="index">
          <td>{{ item.name }}</td>
          <td>{{ item.type }}</td>
          <td>{{ item.hash }}</td>
          <td>{{ item.size }}</td>
          <td>{{ item.status }}</td>
          <td>
            <button @click="uploadItem(item)">上传</button>
            <button @click="cancelItem(item)">取消上传</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <button @click="pause">暂停</button>
  <button @click="resume">继续</button>
  <button @click="clear">清除</button>
</template>

<script setup>
import fileUpload from './fileUpload';
import { computed, ref } from 'vue';

const fileUploadClient = ref();
const fileUploadClientVersion = ref(0);
const fileList = computed(() => {
  fileUploadClientVersion.value;
  console.log('update fileList')
  return fileUploadClient.value?.fileObjects || [];
});



async function handleFilePick(e) {
  console.log(e.target.files[0])

  window.f = e.target.files[0]

  console.time('upload')
  fileUploadClient.value = await fileUpload.createUploadClient({
    chunkSize: 1024 * 1024,
    file: e.target.files[0],
    onUpdateStatus: () => {
      fileUploadClientVersion.value += 1;
    },
    onUpdateHash: (bool) => {
      fileUploadClientVersion.value += 1;
      console.log('onUpdateHash', fileUploadClientVersion.value)
      if (bool) {
        console.timeEnd('upload')
      }
    },
  });
  console.log(fileUploadClient.value)
  // console.timeEnd('upload')
  e.target.value = ''
}

function cancelItem(item) {
  item && item.cancel();
}

function uploadItem(item) {
  item && item.upload();
}

function pause() {
  window.x && window.x.cancel();
}

function resume() {
  window.x && window.x.upload();
}

function clear() {
  window.x = null;
}
</script>


<style lang="scss">
.file-picker-zone {
  position: relative;
  width: 200px;
  height: 200px;
  border: 1px solid #ccc;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;

  input[type="file"] {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
  }
}
</style>


