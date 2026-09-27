'use client';

import { useProjectStore } from '@/store/projectStore';

interface AgentWaitingProps {
  agentName: string;
  className?: string;
  onRetry: () => void;
}

// Empty state of an agent step: waiting, or, if the run failed, the error and a way to retry
// (otherwise the step stays on "Waiting for..." forever after a timeout).
export default function AgentWaiting({ agentName, className, onRetry }: AgentWaitingProps) {
  const error = useProjectStore(state => state.error);

  if (!error) {
    return (
      <div className={className}>
        <p>Waiting for {agentName}...</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <p>The {agentName} did not respond: {error}</p>
      <p>The first run can be slow while the local model loads. Try again.</p>
      <button className="btn btn-primary" onClick={onRetry}>Retry</button>
    </div>
  );
}
