const OPTIONS_TRIGGER_TERMS = [
  'more options', 'options', 'optionen', 'report', 'melden',
];

export const buildSafeClickHelpers = (opts: { includeLikeText?: boolean } = {}) => {
  const parts = [
    `const OPTIONS_TRIGGER_TERMS = ${JSON.stringify(OPTIONS_TRIGGER_TERMS)};`,
    "const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim().toLowerCase();",
    'const isOptionsTrigger = (node) => {',
    '  const combined = [',
    "    norm(node?.innerText || node?.textContent || ''),",
    "    norm(node?.getAttribute?.('aria-label')),",
    "    norm(node?.getAttribute?.('title')),",
    "  ].join(' ');",
    '  return OPTIONS_TRIGGER_TERMS.some((term) => combined.includes(term));',
    '};',
    'const hasVisibleBox = (node) => {',
    '  if (!(node instanceof Element)) return false;',
    '  const r = node.getBoundingClientRect();',
    '  return r.width >= 8 && r.height >= 8;',
    '};',
    'const isEffectivelyHidden = (node) => {',
    '  if (!(node instanceof Element)) return true;',
    '  const cs = window.getComputedStyle(node);',
    "  return cs.display === 'none' || cs.visibility === 'hidden'",
    "    || cs.pointerEvents === 'none' || node.getAttribute('aria-hidden') === 'true';",
    '};',
    'const isSaneClickTarget = (node) => {',
    '  if (!(node instanceof Element)) return false;',
    '  if (isOptionsTrigger(node)) return false;',
    '  if (isEffectivelyHidden(node)) return false;',
    '  if (!hasVisibleBox(node)) return false;',
    "  if (node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true') return false;",
    '  return true;',
    '};',
  ];
  if (opts.includeLikeText) {
    parts.push('const isLikeText = (s) => /^\\s*\\d+[\\d.,]*\\s*likes?\\s*$/i.test(s || "") || /^\\s*\\d+[\\d.,]*\\s*gefällt\\s*mir(?:-angaben|\\s*mal)?\\s*$/i.test(s || "") || /^\\s*gefällt\\s+\\d+[\\d.,]*\\s*mal\\s*$/i.test(s || "");');
  }
  return parts.join('\n');
};
