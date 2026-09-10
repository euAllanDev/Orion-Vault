import type { AgentTaskContextService } from '../../application/services/agent-task-context.service';
import type { AiBridgeResponseDto } from '../../application/dto/ai-bridge.dto';
import type { OrionKnowledgeFacade } from '../../application/services/orion-knowledge-facade';
import type { MultiVaultContextData, MultiVaultSearchData } from '../mcp/orion-multi-vault';
import { createAiBridgeRuntime } from '../runtime/ai-bridge-runtime';

type AgentSearchData = Omit<MultiVaultSearchData, 'vaultRoot' | 'resultVaultIndexes'>;
type AgentContextData = Omit<MultiVaultContextData, 'vaultRoot' | 'chunkVaultIndexes' | 'focusVaultIndex'>;

export interface AgentKnowledge {
  search(input: Parameters<OrionKnowledgeFacade['search']>[0]): Promise<Omit<AiBridgeResponseDto<MultiVaultSearchData>, 'data'> & { readonly data: AgentSearchData }>;
  context(input: Parameters<OrionKnowledgeFacade['context']>[0]): Promise<Omit<AiBridgeResponseDto<MultiVaultContextData>, 'data'> & { readonly data: AgentContextData }>;
  read: OrionKnowledgeFacade['read'];
  related: OrionKnowledgeFacade['related'];
}

/** Only capabilities a skill may receive from an in-process agent host. */
export interface AgentRuntime {
  readonly knowledge: AgentKnowledge;
  readonly tasks: Pick<AgentTaskContextService, 'create' | 'get' | 'update' | 'reopen'>;
}

export type AgentRuntimeFactory = () => AgentRuntime;

/** Session-scoped owner for one runtime shared by all skill executions in that session. */
export class AgentRuntimeHost {
  private runtime: AgentRuntime | undefined;

  constructor(factory: AgentRuntimeFactory) {
    this.runtime = factory();
  }

  getRuntime(): AgentRuntime {
    if (!this.runtime) throw new Error('Agent runtime host is disposed');
    return this.runtime;
  }

  dispose(): void {
    this.runtime = undefined;
  }
}

function exposeKnowledge(knowledge: OrionKnowledgeFacade): AgentKnowledge {
  return Object.freeze({
    async search(input: Parameters<OrionKnowledgeFacade['search']>[0]) {
      const result = await knowledge.search(input);
      const { vaultRoot: _vaultRoot, resultVaultIndexes: _resultVaultIndexes, ...data } = result.data;
      return { ...result, data };
    },
    async context(input: Parameters<OrionKnowledgeFacade['context']>[0]) {
      const result = await knowledge.context(input);
      const { vaultRoot: _vaultRoot, chunkVaultIndexes: _chunkVaultIndexes, focusVaultIndex: _focusVaultIndex, ...data } = result.data;
      return { ...result, data };
    },
    read: knowledge.read.bind(knowledge),
    related: knowledge.related.bind(knowledge)
  });
}

/** Creates one restricted skill-facing view over existing runtime capabilities. */
export function createAgentRuntime(knowledge: OrionKnowledgeFacade, tasks: AgentTaskContextService): AgentRuntime {
  return Object.freeze({ knowledge: exposeKnowledge(knowledge), tasks });
}

/** Creates the production runtime once, then exposes only the skill-safe surface. */
export function createAgentRuntimeHost(vaultRootOverride?: string): AgentRuntimeHost {
  return new AgentRuntimeHost(() => {
    const runtime = createAiBridgeRuntime(vaultRootOverride);
    return createAgentRuntime(runtime.knowledge, runtime.tasks);
  });
}
