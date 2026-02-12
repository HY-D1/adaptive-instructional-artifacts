export type TemplateId = 'explanation.v1' | 'notebook_unit.v1';

export const TEMPLATE_CATALOG: Record<TemplateId, { id: TemplateId; intent: string; outputContract: string }> = {
  'explanation.v1': {
    id: 'explanation.v1',
    intent: 'Produce a concise grounded explanation after escalation.',
    outputContract: 'JSON with fields: title, content_markdown, key_points[], common_pitfall, next_steps[], source_ids[]'
  },
  'notebook_unit.v1': {
    id: 'notebook_unit.v1',
    intent: 'Produce a reflective My Notes unit for notebook storage.',
    outputContract: 'JSON with fields: title, content_markdown, key_points[], common_pitfall, next_steps[], source_ids[]'
  }
};

export function renderPrompt(templateId: TemplateId, sourcesJson: string): string {
  const template = TEMPLATE_CATALOG[templateId];

  return [
    'You are a constrained SQL learning content realizer.',
    'Use ONLY facts from the provided Sources.',
    'If a required detail is absent, write exactly: "Not found in provided sources."',
    'Do not add outside facts, external SQL rules, or fabricated examples.',
    'Return ONLY valid JSON and no surrounding text.',
    'Output must be a single JSON object (not markdown, not prose, not arrays).',
    'Do not wrap the JSON in code fences.',
    'Use double quotes for all keys and string values.',
    'Do not use comments or trailing commas.',
    'Required arrays must contain at least one item: key_points, next_steps, source_ids.',
    template.intent,
    `Template ID: ${template.id}`,
    `Output contract: ${template.outputContract}`,
    'Sources:',
    sourcesJson,
    'JSON schema guidance:',
    '{',
    '  "title": "string",',
    '  "content_markdown": "string",',
    '  "key_points": ["string"],',
    '  "common_pitfall": "string",',
    '  "next_steps": ["string"],',
    '  "source_ids": ["string"]',
    '}'
  ].join('\n');
}
