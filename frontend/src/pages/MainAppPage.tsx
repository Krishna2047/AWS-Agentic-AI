import React, { useEffect, useRef, useState } from 'react';
import AppLayout from '@cloudscape-design/components/app-layout';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Container from '@cloudscape-design/components/container';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import PromptInput from '@cloudscape-design/components/prompt-input';
import Tabs from '@cloudscape-design/components/tabs';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import { useChatStore } from '../store/chatStore';
import { useWorkflowStore } from '../store/workflowStore';
import { useAccountStore } from '../store/accountStore';
import { apiClient } from '../services/api/apiClient';
import { MessageDisplay, StreamingIndicator } from '../components/MessageDisplay';
import { NavigationPanel } from '../components/NavigationPanel';
import WorkflowPanel from '../components/WorkflowPanel';
import DashboardPage from './DashboardPage';
import type { ChatMessage, SSEProgressEvent } from '../types';

let stepCounter = 0;

function makeStepId() {
  return `step-${++stepCounter}-${Date.now()}`;
}

const AGENT_KEYWORDS: Record<string, string[]> = {
  cost: ['cost', 'spend', 'bill', 'budget', 'pricing', 'expense', 'saving'],
  cloudwatch: ['alarm', 'cloudwatch', 'metric', 'log', 'monitor', 'performance', 'cpu', 'memory'],
  security: ['security', 'finding', 'compliance', 'vulnerability', 'securityhub'],
  advisor: ['advisor', 'best practice', 'recommendation', 'trusted', 'optimize'],
  youtrack: ['youtrack', 'ticket', 'issue', 'incident'],
  knowledge: ['troubleshoot', 'how to', 'guide', 'kb', 'fix', 'resolve'],
};

function buildRoutingReason(message: string, agentHint: string): string {
  const msg = message.toLowerCase();
  const keywords = AGENT_KEYWORDS[agentHint] || [];
  const matched = keywords.filter((keyword) => msg.includes(keyword));
  if (matched.length > 0) return `Keywords detected: ${matched.slice(0, 4).join(', ')}`;
  return `${agentHint} domain query`;
}

function MainAppPage() {

  const {
    messages,
    inputValue,
    isLoading,
    conversationId,
    addMessage,
    setInputValue,
    setLoading,
    clearMessages,
    setStreaming,
    setStreamingStage,
    setStreamingAgent,
    appendStreamingContent,
    clearStreaming,
    appendThinkingStep,
    setRoutingDecision,
    getAndClearThinkingData,
  } = useChatStore();
  const {
    smartWorkflowsEnabled,
    fullAutomationEnabled,
    setPendingWorkflowId,
    openWorkflowPanel,
    closeWorkflowPanel,
    isOpen: workflowPanelOpen,
    activeWorkflowId,
  } = useWorkflowStore();
  const { selectedAccount } = useAccountStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    addMessage(userMessage);
    const messageText = inputValue;
    setInputValue('');
    setLoading(true);
    setStreaming(true);
    setStreamingStage('Analyzing your request...');
    const requestStartTime = Date.now();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const capturedAgents = new Set<string>();

      const handleSSEEvent = (event: SSEProgressEvent) => {
        switch (event.event) {
          case 'progress': {
            const msg = event.data.message || event.data.stage || '';
            setStreamingStage(msg);
            if (msg) {
              appendThinkingStep({
                id: makeStepId(),
                type: 'progress',
                message: msg,
                timestamp: Date.now(),
                status: 'success',
              });
            }
            break;
          }

          case 'agent_switch': {
            const toAgent = event.data.to_agent || '';
            const fromAgent = event.data.from_agent || 'supervisor';
            const backendReason = (event.data as { routing_reason?: string }).routing_reason || '';
            const routingReason = backendReason || buildRoutingReason(messageText, toAgent);
            const switchMsg = routingReason
              ? `Routing to ${toAgent}: ${routingReason}`
              : event.data.message || `Delegating to ${toAgent}...`;
            setStreamingAgent(toAgent);
            setStreamingStage(switchMsg);
            appendThinkingStep({
              id: makeStepId(),
              type: 'agent_switch',
              message: switchMsg,
              agentName: toAgent,
              routingReason,
              timestamp: Date.now(),
              status: 'success',
            });
            setRoutingDecision({
              queryType: messageText.length > 80 ? `${messageText.slice(0, 80)}...` : messageText,
              selectedAgent: toAgent,
              alternativeAgents: fromAgent !== 'supervisor' ? fromAgent : '',
              routingReason,
              timestamp: Date.now(),
            });
            break;
          }

          case 'tool_call': {
            const toolName = event.data.tool_name || 'tool';
            const isResult = event.data.status === 'complete';
            const extendedData = event.data as { result_preview?: string; routing_reason?: string; agent?: string };
            const resultPreview = extendedData.result_preview || '';
            const toolQuery = extendedData.routing_reason || messageText.slice(0, 80);

            if (isResult) {
              const agentName = extendedData.agent || 'Agent';
              const resultMsg = resultPreview
                ? `${agentName} responded: "${resultPreview.slice(0, 120)}${resultPreview.length > 120 ? '...' : ''}"`
                : `${agentName} response received`;
              setStreamingStage(resultMsg);
              appendThinkingStep({
                id: makeStepId(),
                type: 'tool_result',
                message: resultMsg,
                agentName,
                timestamp: Date.now(),
                status: 'success',
              });
            } else {
              const toolMsg = `${toolName}: "${toolQuery}"`;
              setStreamingStage(`${toolName} executing...`);
              appendThinkingStep({
                id: makeStepId(),
                type: 'tool_call',
                message: toolMsg,
                toolName,
                timestamp: Date.now(),
                status: 'in-progress',
              });
            }
            break;
          }

          case 'content': {
            if (event.data.text) {
              appendStreamingContent(event.data.text);
              const extendedData = event.data as { is_reasoning?: boolean };
              const isReasoning = extendedData.is_reasoning === true;
              const agentType = event.data.agent_type || '';
              const text = event.data.text.trim();

              const addContentStep = (
                agentName: string,
                messagePrefix: string,
                status: 'success' | 'in-progress',
              ) => {
                if (text.length <= 5) return;
                const preview = text.length > 120 ? `${text.slice(0, 120)}...` : text;
                appendThinkingStep({
                  id: makeStepId(),
                  type: 'content',
                  message: messagePrefix ? `${messagePrefix}: ${preview}` : preview,
                  agentName,
                  timestamp: Date.now(),
                  status,
                });
              };

              if (isReasoning || agentType === 'supervisor') {
                addContentStep('supervisor', '', 'success');
              } else if (agentType && !capturedAgents.has(agentType)) {
                capturedAgents.add(agentType);
                addContentStep(agentType, agentType, 'in-progress');
              }
            }
            if (event.data.agent_type) setStreamingAgent(event.data.agent_type);
            break;
          }

          default:
            break;
        }
      };

      const response = await apiClient.sendMessageStream(
        {
          message: messageText,
          account_name: selectedAccount?.id || 'default',
          workflow_enabled: smartWorkflowsEnabled,
          full_automation: fullAutomationEnabled,
          conversation_id: conversationId,
        },
        handleSSEEvent,
        abortController.signal
      );

      const { steps: thinkingSteps, routing: routingDecision } = getAndClearThinkingData();
      clearStreaming();

      const responseTimeMs = Date.now() - requestStartTime;
      const resolvedAgentType =
        response.agent_type?.toLowerCase() === 'supervisor' && routingDecision?.selectedAgent
          ? routingDecision.selectedAgent
          : response.agent_type;
      const agentMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: response.content,
        sender: 'agent',
        agentType: resolvedAgentType,
        timestamp: new Date(),
        responseTimeMs,
        workflowTriggered: response.workflow_triggered,
        workflowId: response.workflow_id || undefined,
        requiresApproval: response.workflow_triggered && !fullAutomationEnabled,
        isAutomated: response.workflow_triggered && fullAutomationEnabled,
        thinkingSteps: thinkingSteps.length > 0 ? thinkingSteps : undefined,
        routingDecision: routingDecision || undefined,
      };

      addMessage(agentMessage);

      if (response.workflow_triggered && response.workflow_id) {
        setPendingWorkflowId(response.workflow_id);
        openWorkflowPanel(response.workflow_id, fullAutomationEnabled);
      }
    } catch (error: any) {
      const { steps: errorThinkingSteps, routing: errorRouting } = getAndClearThinkingData();
      clearStreaming();
      const isStopped = error?.name === 'AbortError' || abortController.signal.aborted;
      if (isStopped) {
        return;
      }
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: `Error: ${error.message || 'Failed to get response'}`,
        sender: 'agent',
        agentType: 'Error',
        timestamp: new Date(),
        thinkingSteps: errorThinkingSteps.length > 0 ? errorThinkingSteps : undefined,
        routingDecision: errorRouting || undefined,
      };
      addMessage(errorMessage);
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const handleStopConversation = () => {
    abortControllerRef.current?.abort();
  };

  return (
    <AppLayout
      content={
        <div className="msp-shell">
          <div className="msp-shell__content">
            <SpaceBetween size="l">
              <div className="msp-shell__hero">
                <div className="msp-shell__hero-topbar">
                  <div className="msp-shell__eyebrow">Operational Intelligence Workspace</div>
                </div>
                <h1 className="msp-shell__hero-title">AWS MSP Smart Agent Assist</h1>
                <p className="msp-shell__hero-description">
                  Investigate incidents, surface cost drivers, coordinate remediation, and move from insight to action through a more polished operator experience.
                </p>
                <div className="msp-shell__hero-metrics">
                  <div className="msp-shell__metric">
                    <div className="msp-shell__metric-label">Command center</div>
                    <div className="msp-shell__metric-value">Chat, dashboard, workflows</div>
                  </div>
                  <div className="msp-shell__metric">
                    <div className="msp-shell__metric-label">Coverage</div>
                    <div className="msp-shell__metric-value">Monitoring, cost, security, ITSM</div>
                  </div>
                  <div className="msp-shell__metric">
                    <div className="msp-shell__metric-label">Experience</div>
                    <div className="msp-shell__metric-value">Faster handoffs and calmer operations</div>
                  </div>
                </div>
                <p className="msp-shell__hero-description" style={{ marginTop: '18px', maxWidth: '700px' }}>
                  Ask about alarms, EC2 health, service costs, security findings, Trusted Advisor, or YouTrack actions and the workspace will route the request to the right specialist.
                </p>
                <div className="msp-shell__hero-actions">
                  <div className="msp-shell__hero-pill">Premium operator workspace</div>
                  <div className="msp-shell__hero-pill">Elegant light experience across pages</div>
                </div>
              </div>

              <div className="msp-tab-card">
                <Tabs
                  tabs={[
                    {
                      label: 'Chat',
                      id: 'chat',
                      content: (
                        <Container>
                          <div className="chat-stage">
                            <SpaceBetween size="l">
                              {messages.length === 0 && (
                                <div className="chat-stage__welcome">
                                  <Box color="text-body-secondary" textAlign="center">
                                    <div className="chat-stage__title">Welcome to your operations console</div>
                                    <Box variant="p">
                                      Ask about alarms, troubleshooting, security, cost, or issue management. The sidebar keeps your most-used actions ready.
                                    </Box>
                                  </Box>
                                </div>
                              )}

                              {messages.length > 0 && (
                                <div className="message-stack">
                                  {messages.map((message) => (
                                    <MessageDisplay key={message.id} message={message} />
                                  ))}
                                </div>
                              )}

                              <StreamingIndicator />
                              <div ref={messagesEndRef} />

                              <div className="chat-input-shell">
                                <div className="chat-input-shell__field">
                                  <PromptInput
                                    value={inputValue}
                                    onChange={({ detail }) => setInputValue(detail.value)}
                                    onAction={handleSendMessage}
                                    actionButtonIconName="send"
                                    actionButtonAriaLabel="Send message"
                                    ariaLabel="Message input"
                                    placeholder="Ask about AWS problems, troubleshoot issues, create ITSM tickets, and resolve incidents..."
                                    maxRows={5}
                                    minRows={1}
                                    disabled={isLoading}
                                  />
                                </div>
                                {isLoading && (
                                  <Button iconName="remove" variant="primary" onClick={handleStopConversation}>
                                    Stop
                                  </Button>
                                )}
                              </div>

                              <div className="chat-tips">
                                <div className="chat-tips__title">Conversation tips</div>
                                <SpaceBetween size="xs">
                                  <div className="chat-tips__item">Ask about CloudWatch alarms, metrics, and logs for monitoring questions.</div>
                                  <div className="chat-tips__item">Use “How to troubleshoot...” or “Steps to resolve...” for knowledge-base guidance.</div>
                                  <div className="chat-tips__item">Use “Create ticket...” or “File bug...” to open YouTrack work items.</div>
                                  <div className="chat-tips__item">Enable Smart Workflows for CloudWatch to YouTrack to remediation automation.</div>
                                  <div className="chat-tips__item">Enable Full Automation for zero-click incident response when you want the system to execute end to end.</div>
                                </SpaceBetween>
                              </div>
                            </SpaceBetween>
                          </div>
                        </Container>
                      ),
                    },
                    {
                      label: 'Dashboard',
                      id: 'dashboard',
                      content: <DashboardPage />,
                    },
                  ]}
                />
              </div>
            </SpaceBetween>
          </div>
        </div>
      }
      navigation={<NavigationPanel />}
      navigationWidth={320}
      tools={<WorkflowPanel />}
      toolsWidth={350}
      toolsOpen={workflowPanelOpen && !!activeWorkflowId}
      onToolsChange={({ detail }) => {
        if (!detail.open) closeWorkflowPanel();
      }}
      toolsHide={!activeWorkflowId}
    />
  );
}

export default MainAppPage;
