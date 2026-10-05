'use client';
import type { Dispatch } from 'react';
import { QcButton } from '../../ui/v2/QcButton';
import { Icon } from './Choice';
import { Disclosure } from './WorkflowQuestions';
import { ASSISTANT_LABELS, workloadLabel } from './description';
import type { AnswerAction } from './state';
import type { CalculatorAnswers, CalculatorCatalog, Calculation, AssistantLevel } from './types';
export function AssistantQuestion({ answers, result, catalog, dispatch, id }: {
  answers: CalculatorAnswers; result: Calculation; catalog: CalculatorCatalog; dispatch: Dispatch<AnswerAction>; id: string;
}) {
  const levels: Exclude<AssistantLevel, 'none'>[] = ['light','regular','heavy'];
  const descriptions = { light: 'Now and then', regular: 'Most weeks', heavy: 'Every day' };
  return <div className="qcp-assistant-body">
    <div className="qcp-assistant-pitch"><span className="qcp-assistant-symbol"><Icon name="spark" size={26} /></span><div>
      <strong>{answers.device === 'mobile' ? 'Talk instead of tap.' : answers.device === 'mixed' ? 'Text or voice. Your choice.' : 'Less admin. More progress.'}</strong>
      <p>{answers.device === 'mobile' ? 'Create, edit, price and send quotes by text or voice, without tapping through every screen.' : 'Create or edit quotes, change prices, find information and send quotes using text or voice.'}</p>
    </div></div>
    <fieldset className="qcp-fieldset"><legend>Choose your monthly allowance</legend>
      <div className="qcp-assistant-levels">{levels.map(level => <label key={level} className="qcp-allowance" data-selected={result.selectedAssistant === level || undefined}>
        <input type="radio" name={`${id}-assistant`} value={level} checked={result.selectedAssistant === level} form={`${id}-detached`}
          onChange={() => dispatch({ type: 'assistant', value: level })} aria-describedby={`${id}-${level}-detail`} />
        <span className="qcp-allowance-indicator" aria-hidden="true"><Icon name={level === 'heavy' ? 'bolt' : level === 'regular' ? 'spark' : 'clock'} size={20} /></span>
        <strong>{ASSISTANT_LABELS[level]}</strong><span className="qcp-task-count">{catalog.assistant[level].tasks.toLocaleString()}<small>Assistant Tasks / month</small></span><span className="qcp-muted" id={`${id}-${level}-detail`}>{descriptions[level]}</span>
        {level === result.recommendedAssistant && <span className="qcp-badge">Recommended</span>}
        <span className="qcp-check" aria-hidden="true">{result.selectedAssistant === level && <Icon name="check" size={14} />}</span>
      </label>)}</div>
      <label className="qcp-no-assistant" data-selected={result.selectedAssistant === 'none' || undefined}>
        <input type="radio" name={`${id}-assistant`} value="none" checked={result.selectedAssistant === 'none'} form={`${id}-detached`}
          onChange={() => dispatch({ type: 'assistant', value: 'none' })} />
        <span>No Assistant  -  I’ll do it manually</span><span className="qcp-check" aria-hidden="true">{result.selectedAssistant === 'none' && <Icon name="check" size={14} />}</span>
      </label>
    </fieldset>
    <p className="qcp-recommendation">Based on <strong>{workloadLabel(answers)}</strong>, we recommend <strong>{ASSISTANT_LABELS[result.recommendedAssistant]}</strong>. Your choice stays in your control.</p>
    {result.warnings.filter(w => w.code === 'assistant-lower').map(w => <p key={w.code} className="qcp-warning">{w.text}</p>)}
    {answers.assistant !== 'recommended' && result.selectedAssistant !== result.recommendedAssistant && <QcButton variant="glass" className="qcp-clear qcp-use-recommended" onClick={() => dispatch({ type: 'assistant', value: 'recommended' })}>Use workload recommendation</QcButton>}
    <p className="qcp-task-rule">1 use = 1 task or request.</p>
    <Disclosure title="Smart Assistant · V1 Beta"><p>Give it a task instead of working through the app yourself. Review changes and confirm before sending quotes. Roof Scan Assist remains a separate tool. Some requests still need a manual step while we improve V1.</p><p>Your reduced Beta rate applies while we improve V1. Feedback helps shape what comes next.</p><p>{catalog.assistantRule} If you reach your limit, upgrade or carry on manually until your allowance renews.</p></Disclosure>
  </div>;
}
