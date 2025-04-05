
function getError(xhr, method, errorType) {
  let msg = '';
  if (xhr.response) {
    msg = `${xhr.response.error || xhr.response}`;
  } else if (xhr.responseText) {
    msg = `${xhr.responseText}`;
  } else {
    msg = `fail to ${method} ${xhr.responseURL} ${xhr.status}`;
  }
  const error = new Error(msg);
  error.type = errorType;
  error.url = xhr.responseURL;
  error.method = method;
  return error;
}

function getBody(xhr) {
  const text = xhr.responseText || xhr.response
  if (!text) {
    return text
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function ajax(option) {
  option = {
    url: '',
    method: 'POST',
    file: null,
    fileKey: 'file',
    query: null,
    data: null,
    headers: null,
    withCredentials: false,
    onProgress: null,
    onSuccess: null,
    onError: null,
    ...option,
  };

  const xhr = new XMLHttpRequest();

  let url = option.url;

  if (option.query) {
    const queryString = new URLSearchParams(option.query).toString();
    if (url.includes('?')) {
      url += `&${queryString}`;
    } else {
      url += `?${queryString}`;
    }
  }

  xhr.open(option.method, url, true);

  if (option.headers) {
    if (option.headers instanceof Headers) {
      option.headers.forEach((value, key) => {
        xhr.setRequestHeader(key, value)
      });
    } else {
      Object.entries(option.headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, String(value))
      });
    }
  }

  if (option.withCredentials && 'withCredentials' in xhr) {
    xhr.withCredentials = true
  }

  if (xhr.upload) {
    xhr.upload.addEventListener('progress', (evt) => {
      evt.percent = evt.total > 0 ? (evt.loaded / evt.total) * 100 : 0
      option.onProgress && option.onProgress(evt)
    })
  }

  const _onEnd = () => {
    xhr.onreadystatechange = null
    xhr.ontimeout = null
    xhr.onabort = null
    xhr.onerror = null
  }

  const _onSuccess = () => {
    option.onSuccess && option.onSuccess(getBody(xhr));
    _onEnd();
  };

  const _onError = (errorType) => {
    option.onError && option.onError(getError(xhr, option.method, errorType));
    _onEnd();
  }

  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4) {
      if (xhr.status >= 200 && xhr.status < 300) {
        _onSuccess(getBody(xhr));
      } else {
        _onError('error');
      }
    }
  };

  xhr.ontimeout = () => {
    _onError('timeout');
  };

  xhr.onabort = () => {
    _onError('canceled');
  };

  xhr.onerror = () => {
    _onError('error');
  };

  const formData = new FormData();

  if (option.data) {
    Object.entries(option.data).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        formData.append(key, ...value);
      } else {
        formData.append(key, value);
      }
    });
  }
  formData.append(option.fileKey, option.file, option.file.name);

  xhr.send(formData);

  return xhr;
}

export function mapLimit(data, option, callback) {
  option = {
    limit: 4,
    breakIfError: null,
    ...option,
  };
  const { limit, breakIfError } = option;

  return new Promise((resolve, reject) => {
    const results = [];
    let finished = 0;
    let index = 0;
    let runningCount = 0;

    const next = async () => {
      if (runningCount >= limit) return;
      if (index >= data.length) return;

      const item = data[index];
      runningCount += 1;
      index += 1;

      try {
        const resp = await callback(item);
        results.push({ status: 'fulfilled', value: resp });
      } catch (error) {
        results.push({ status: 'rejected', reason: error });

        if (typeof breakIfError === 'function' && breakIfError(error, item)) {
          return reject(error);
        }
      }

      finished += 1;
      runningCount -= 1;
      
      if (finished === data.length) {
        return resolve(results);
      } else {
        next();
      }
    };

    if (data.length === 0) {
      return resolve(results);
    }

    for (let i = 0; i < data.length; i++) {
      next();
    }
  });
}
