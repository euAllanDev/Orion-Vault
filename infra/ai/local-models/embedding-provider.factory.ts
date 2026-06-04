import type { AppConfig } from '../../config/app-config';
import type { EmbeddingProviderPort } from '../../../application/ports/embedding-provider.port';
import { ExpandedTokenHashEmbeddingProvider } from './expanded-token-hash-embedding.provider';
import { ExternalCommandEmbeddingProvider } from './external-command-embedding.provider';
import { NoopLocalEmbeddingProvider } from './noop-local-embedding.provider';
import { TokenHashEmbeddingProvider } from './token-hash-embedding.provider';

export function createEmbeddingProvider(config: Pick<AppConfig, 'embeddingsProvider' | 'embeddingsCommand'>): EmbeddingProviderPort {
  if (config.embeddingsProvider === 'token-hash') {
    return new TokenHashEmbeddingProvider();
  }

  if (config.embeddingsProvider === 'expanded-token-hash') {
    return new ExpandedTokenHashEmbeddingProvider();
  }

  if (config.embeddingsProvider === 'external-command') {
    return new ExternalCommandEmbeddingProvider(config.embeddingsCommand ?? '');
  }

  return new NoopLocalEmbeddingProvider();
}
