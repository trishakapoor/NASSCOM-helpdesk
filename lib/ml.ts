import { pipeline, env } from '@xenova/transformers';

// Configure transformers to not use local downloaded models if they conflict
// and to allow remote fetching on first initialization.
env.allowLocalModels = true;
env.useBrowserCache = false; 

class PipelineSingleton {
  static nerTask = 'token-classification';
  static nerModel = 'Xenova/bert-base-NER';
  static nerInstance: Promise<any> | null = null;

  static embedTask = 'feature-extraction';
  static embedModel = 'Xenova/bge-small-en-v1.5';
  static embedInstance: Promise<any> | null = null;

  static async getNER() {
    if (this.nerInstance === null) {
      this.nerInstance = pipeline(this.nerTask as any, this.nerModel, { quantized: true });
    }
    return this.nerInstance;
  }

  static async getEmbedding() {
    if (this.embedInstance === null) {
      this.embedInstance = pipeline(this.embedTask as any, this.embedModel, { quantized: true });
    }
    return this.embedInstance;
  }
}

export default PipelineSingleton;
