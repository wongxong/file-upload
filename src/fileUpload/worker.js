import SparkMD5 from "spark-md5";

function computedHash(file, index) {
  return new Promise(resolve => {
    const reader = new FileReader();
    const spark = new SparkMD5.ArrayBuffer();
    reader.onload = e => {
      spark.append(e.target.result);
      resolve({
        index,
        hash: spark.end(),
      });
    };
    reader.readAsArrayBuffer(file);
  });
}

onmessage = async function (e) {
  const { chunks } = e.data;
  const result = chunks.map(chunk => computedHash(chunk.file, chunk.index));
  const hashArray = await Promise.all(result);
  postMessage(hashArray);
}