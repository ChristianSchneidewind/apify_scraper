export const injectHelpers = (script: string, helpers: string) =>
  script.replace('__HELPERS__', helpers);

export const runPayloadScript = <T>(
  body: string,
  payload: Record<string, unknown>,
): T => {
  const fnSource = body.trim().replace(/^return\s+/, '').replace(/;\s*$/, '');
  return new Function('payload', `return (${fnSource})(payload);`)(payload) as T;
};

export const runElementScript = <T>(body: string, el: Element): T =>
  new Function('el', body)(el) as T;

export const runIifeScript = <T>(body: string): T => {
  const source = body.trim().replace(/^return\s+/, '').replace(/;\s*$/, '');
  return new Function(`return ${source}`)() as T;
};

export const browserRunPayload = <T>(
  args: { body: string; payload: Record<string, unknown> },
): T => runPayloadScript<T>(args.body, args.payload);

export const browserRunIife = (args: { body: string }) => runIifeScript(args.body);

export const browserRunElement = <T>(
  args: { body: string },
  el: Element,
): T => runElementScript<T>(args.body, el);
