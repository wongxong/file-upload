const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const initial_xlsx_path = path.resolve(__dirname, './locale/translate.xlsx');
const new_xlsx_path = path.resolve(__dirname, './locale/translate_new.xlsx');

/**
 * 读取指定语言的所有locale文件，并合并为一个json对象
 * @param {'zh_CN' | 'en_US'} language 
 * @returns {Record<string, string>}
 */
function load_locale_json(language, merge) {
  merge = merge || ((output, data, filePath) => Object.assign(output, data));
  const localeFolder = path.resolve(__dirname, `./locale/${language}`);
  
  const files = fs.readdirSync(localeFolder).filter(file => path.extname(file) === '.json');
  let data = {};

  for (const file of files) {
    const filePath = path.resolve(localeFolder, file);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const jsonContent = JSON.parse(fileContent);
    data = merge(data, jsonContent, filePath);
  }

  return data;
}

/**
 * array json对象转换为xlsx文件
 * @param {Array<any>} json 
 */
function locale_to_xlsx(json, filePath) {
  const workBook = xlsx.utils.book_new();
  const workSheet = xlsx.utils.json_to_sheet(json);
  xlsx.utils.book_append_sheet(workBook, workSheet, 'Sheet1');
  xlsx.writeFile(workBook, filePath);
}

/**
 * 生成初始的xlsx文件
 */
async function generate_initial_xlsx() {
  const zh_CN_locale_json = load_locale_json('zh_CN');
  const en_US_locale_json = load_locale_json('en_US');
  const rows = Object.keys(zh_CN_locale_json).map(key => {
    return {
      key,
      zh_CN: zh_CN_locale_json[key],
      en_US: en_US_locale_json[key],
    };
  });
  locale_to_xlsx(rows, initial_xlsx_path);
}

function compare_locale_json_keys() {
  const merge = (output, data, filePath) => {
    Object.keys(data).forEach(key => {
      output[key] = filePath;
    })
    return output;
  };
  const zh_CN_locale_json = load_locale_json('zh_CN', merge);
  const en_US_locale_json = load_locale_json('en_US', merge);

  Object.keys(zh_CN_locale_json).forEach(key => {
    if (!en_US_locale_json[key]) {
      console.log(`en_US中缺少key: ${key} -> ${zh_CN_locale_json[key]}`);
    }
  });

  Object.keys(en_US_locale_json).forEach(key => {
    if (!zh_CN_locale_json[key]) {
      console.log(`en_US中有多余的key: ${key} -> ${en_US_locale_json[key]}`);
    }
  });
}

/**
 * 读取本地的xlsx文件，并转换为json对象
 * @returns {Array<any>}
 */
function load_xlsx_json() {
  const workBook = xlsx.readFile(initial_xlsx_path);
  const workSheet = workBook.Sheets['Sheet1'];
  const json = xlsx.utils.sheet_to_json(workSheet);
  return json;
}

async function update_xlsx() {
  const zh_CN_locale_json = load_locale_json('zh_CN');
  const en_US_locale_json = load_locale_json('en_US');
  const xlsx_rows = load_xlsx_json();
  const zh_CN_xlsx_json = {};
  const en_US_xlsx_json = {};
  const desc_json = {};
  
  for (const row of xlsx_rows) {
    zh_CN_xlsx_json[row.key] = row.zh_CN;
    en_US_xlsx_json[row.key] = row.en_US;
  }

  Object.keys(zh_CN_locale_json).forEach(key => {
    if (!desc_json[key]) {
      desc_json[key] = {};
    }
    
    if (zh_CN_locale_json[key] !== zh_CN_xlsx_json[key]) {
      if (zh_CN_xlsx_json[key]) {
        desc_json[key]['备注1'] = `中文变更：${zh_CN_xlsx_json[key]} -> ${zh_CN_locale_json[key]}`;
      } else {
        desc_json[key]['备注1'] = '新增key';
      }
    }

    if (en_US_locale_json[key] !== en_US_xlsx_json[key]) {
      if (en_US_xlsx_json[key]) {
        desc_json[key]['备注2'] = `英文变更：${en_US_xlsx_json[key]} -> ${en_US_locale_json[key]}`;
      } else {
        desc_json[key]['备注2'] = '新增key';
      }
    }
  });

  Object.keys(zh_CN_xlsx_json).forEach(key => {
    if (!desc_json[key]) {
      desc_json[key] = {};
    }

    if (zh_CN_xlsx_json[key] !== zh_CN_locale_json[key]) {
      if (zh_CN_locale_json[key]) {
        desc_json[key]['备注1'] = `中文变更：${zh_CN_xlsx_json[key]} -> ${zh_CN_locale_json[key]}`;
      } else {
        desc_json[key]['备注1'] = '删除key';
        zh_CN_locale_json[key] = zh_CN_xlsx_json[key];
        en_US_locale_json[key] = en_US_xlsx_json[key];
      }
    }
    
    if (en_US_xlsx_json[key] !== en_US_locale_json[key]) {
      if (en_US_locale_json[key]) {
        desc_json[key]['备注2'] = `英文变更：${en_US_xlsx_json[key]} -> ${en_US_locale_json[key]}`;
      } else {
        desc_json[key]['备注2'] = '删除key';
        zh_CN_locale_json[key] = zh_CN_xlsx_json[key];
        en_US_locale_json[key] = en_US_xlsx_json[key];
      }
    }
  });

  const rows = Object.keys(zh_CN_locale_json).map(key => {
    return {
      key,
      zh_CN: zh_CN_locale_json[key],
      en_US: en_US_locale_json[key],
      ...desc_json[key],
    };
  });

  locale_to_xlsx(rows, new_xlsx_path);
}

;(async () => {
  // compare_locale_json_keys();
  update_xlsx();
})();