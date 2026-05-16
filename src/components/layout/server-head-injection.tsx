import { getCodeInjectionMap, getEnabledCodeInjection } from "@/features/code-injection/service";

function parseHeadElements(html: string) {
  const elements: Array<{ tag: string; attribs: Record<string, string>; inner?: string }> = [];
  const regex = /<(meta|link|script|style|title)((?:\s+[^>]*?)?)\s*\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const rawAttribs = match[2] || "";
    const attribs: Record<string, string> = {};
    const attrRegex = /([\w-]+)\s*=\s*"([^"]*)"/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRegex.exec(rawAttribs)) !== null) {
      attribs[attrMatch[1]] = attrMatch[2];
    }
    elements.push({ tag, attribs });
  }

  // Also handle <script>...</script> and <style>...</style> with inner content
  const innerRegex = /<(script|style)((?:\s+[^>]*?)?)\s*>([\s\S]*?)<\/\1>/gi;
  while ((match = innerRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const rawAttribs = match[2] || "";
    const inner = match[3] || "";
    const attribs: Record<string, string> = {};
    const attrRegex = /([\w-]+)\s*=\s*"([^"]*)"/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRegex.exec(rawAttribs)) !== null) {
      attribs[attrMatch[1]] = attrMatch[2];
    }
    elements.push({ tag, attribs, inner });
  }

  return elements;
}

export async function ServerHeadInjection() {
  const { settings } = await getCodeInjectionMap();
  const globalHead = getEnabledCodeInjection(settings, "code.globalHead");

  if (!globalHead) return null;

  const elements = parseHeadElements(globalHead);

  if (elements.length === 0) return null;

  return (
    <>
      {elements.map((el, i) => {
        const key = `${el.tag}-${i}`;
        switch (el.tag) {
          case "meta":
            return <meta key={key} {...el.attribs} />;
          case "link":
            return <link key={key} {...el.attribs} />;
          case "script":
            if (el.inner) {
              return (
                <script key={key} {...el.attribs} dangerouslySetInnerHTML={{ __html: el.inner }} />
              );
            }
            return <script key={key} {...el.attribs} />;
          case "style":
            if (el.inner) {
              return (
                <style key={key} {...el.attribs} dangerouslySetInnerHTML={{ __html: el.inner }} />
              );
            }
            return <style key={key} {...el.attribs} />;
          case "title":
            return <title key={key}>{el.inner || ""}</title>;
          default:
            return null;
        }
      })}
    </>
  );
}
