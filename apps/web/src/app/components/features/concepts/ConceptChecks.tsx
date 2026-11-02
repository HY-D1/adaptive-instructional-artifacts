import { useId, useState } from 'react';
interface Check { question: string; options: Array<{ text: string; feedback: string }>; correctIndex: number }
function CheckQuestion({ check }: { check: Check }) {
  const id = useId();
  const [choice, setChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState<number | null>(null);
  return <form className="space-y-4 rounded-lg border p-4" onSubmit={event => { event.preventDefault(); if (choice !== null) setSubmitted(choice); }}><fieldset><legend className="mb-3 font-semibold">{check.question}</legend>{check.options.map((option, index) => <label key={index} className="flex min-h-11 cursor-pointer items-center gap-3 rounded p-2 hover:bg-gray-50"><input type="radio" name={id} checked={choice === index} onChange={() => { setChoice(index); setSubmitted(null); }} />{option.text}</label>)}</fieldset><button type="submit" disabled={choice === null} className="rounded bg-blue-600 px-4 py-3 text-white disabled:opacity-50">Check answer</button>{submitted !== null && <div role="status" className="rounded bg-blue-50 p-3"><p className="font-medium">{submitted === check.correctIndex ? 'Correct.' : 'Try again.'}</p><p>{check.options[submitted].feedback}</p></div>}</form>;
}
export function ConceptChecks({ checks }: { checks: Check[] }) {
  return <div className="space-y-4"><p className="text-sm text-gray-600">Practice your understanding. These checks are repeatable and do not change saved mastery.</p>{checks.map((check, index) => <CheckQuestion key={`${index}-${check.question}`} check={check} />)}</div>;
}
