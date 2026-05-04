import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

const models = {
  'Xenova/bert-base-NER': [
    'config.json',
    'tokenizer.json',
    'tokenizer_config.json',
    'special_tokens_map.json',
    'vocab.txt',
    'onnx/model_quantized.onnx'
  ],
  'Xenova/bge-small-en-v1.5': [
    'config.json',
    'tokenizer.json',
    'tokenizer_config.json',
    'special_tokens_map.json',
    'vocab.txt',
    'onnx/model_quantized.onnx'
  ]
};

const baseUrl = 'https://huggingface.co';

async function downloadFile(url, dest) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`unexpected response ${response.statusText}`);
  await pipeline(response.body, fs.createWriteStream(dest));
}

async function main() {
  const publicDir = path.join(process.cwd(), 'public', 'models');
  
  for (const [model, files] of Object.entries(models)) {
    for (const file of files) {
      const url = `${baseUrl}/${model}/resolve/main/${file}`;
      const destFile = path.join(publicDir, model, file);
      const destDir = path.dirname(destFile);
      
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      console.log(`Downloading ${url}...`);
      try {
        await downloadFile(url, destFile);
        console.log(`Saved to ${destFile}`);
      } catch (e) {
        console.error(`Error downloading ${file}:`, e.message);
      }
    }
  }
  console.log("All models downloaded.");
}

main();
