export type ParsedLesson = {
  title: string;
  order: number;
};

export type ParsedModule = {
  title: string;
  summary: string;
  order: number;
  estimatedTime: string;
  assessment: string;
  lessons: ParsedLesson[];
};

export type ParsedCourse = {
  title: string;
  description: string;
  audience: string;
  objectives: string[];
  modules: ParsedModule[];
};

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const BULLET_RE = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;
const TIME_LABEL_RE = /^\**\s*(?:estimated\s*time|time\s*commit|duration)\s*\**\s*:?\s*(.*)$/i;
const SUMMARY_LABEL_RE = /^\**\s*summary\s*\**\s*:?\s*(.*)$/i;
const ASSESSMENT_LABEL_RE = /^\**\s*(?:suggested\s*)?assessment\s*\**\s*:?\s*(.*)$/i;
const DURATION_RE = /(\d+\s*(?:-|\s)?\s*\d*\s*(?:hours?|hrs?|minutes?|mins?|days?|weeks?))/i;

function clean(text: string): string {
  return text
    .replace(/^\**|\**$/g, "")
    .replace(/[*_`]/g, "")
    .replace(/^[-–—:]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isMetaLabel(text: string) {
  return (
    TIME_LABEL_RE.test(text.trim()) ||
    SUMMARY_LABEL_RE.test(text.trim()) ||
    ASSESSMENT_LABEL_RE.test(text.trim())
  );
}

export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, "")
    .replace(/[*_>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSections(lines: string[]) {
  const sections: { heading: string; level: number; body: string[] }[] = [];
  let current: { heading: string; level: number; body: string[] } | null = null;

  for (const line of lines) {
    const match = line.match(HEADING_RE);
    if (match) {
      if (current) sections.push(current);
      current = { heading: match[2].trim(), level: match[1].length, body: [] };
    } else if (current) {
      current.body.push(line);
    } else {
      current = { heading: "", level: 0, body: [line] };
    }
  }
  if (current) sections.push(current);
  return sections;
}

function findSection(sections: ReturnType<typeof splitSections>, pattern: RegExp) {
  return sections.find((s) => pattern.test(s.heading));
}

function bulletsFrom(body: string[]): string[] {
  return body
    .map((line) => line.match(BULLET_RE))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => clean(m[1]))
    .filter(Boolean);
}

function paragraphFrom(body: string[]): string {
  const out: string[] = [];
  for (const line of body) {
    const t = line.trim();
    if (!t) {
      if (out.length) break;
      continue;
    }
    if (HEADING_RE.test(t) || BULLET_RE.test(t)) break;
    out.push(clean(t));
  }
  return out.join(" ").trim();
}

function extractDuration(text: string): string {
  const m = text.match(DURATION_RE);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

/**
 * Resolve a labelled field whose value may sit on the line *after* the label.
 *
 * Models frequently emit Markdown hard-break style:
 *   **Summary:**
 *   Introduce essential materials and practice basic behaviour.
 *
 * In that case the label's own capture group is empty, so we look ahead to the
 * next non-empty line and use it as the value.
 */
function valueAfterLabel(body: string[], index: number, inline: string): string {
  const direct = clean(inline);
  if (direct) return direct;

  for (let j = index + 1; j < body.length; j += 1) {
    const next = body[j].trim();
    if (!next) continue;
    // Stop at the next label or heading rather than swallowing structure.
    if (HEADING_RE.test(next)) return "";
    if (isMetaLabel(next)) return "";
    if (BULLET_RE.test(next)) return "";
    return clean(next);
  }
  return "";
}

const LESSON_LABEL_RE = /^\**\s*(?:lesson\s*topics?|lessons?|topics?)\s*\**\s*:?\s*$/i;

function parseModuleBlock(
  rawTitle: string,
  body: string[],
  order: number,
  fallbackTime: string,
): ParsedModule {
  // Models often title modules "Module 3: Foo" — the ordinal is redundant once
  // it is stored in its own ordered column.
  const title = clean(rawTitle.replace(/^module\s*\d+\s*[:.\-–—]\s*/i, ""));

  const lessons: string[] = [];
  const assessmentParts: string[] = [];
  let summary = "";
  let estimatedTime = "";
  let assessment = "";

  // Which field the following bullets belong to. Some models wrap lesson and
  // assessment bullets in their own sub-headings, so we track the section.
  let section: "lessons" | "assessment" = "lessons";

  for (let i = 0; i < body.length; i += 1) {
    const line = body[i].trim();
    if (!line) continue;

    if (line === "---" || line === "***" || line === "___") continue;

    const bullet = line.match(BULLET_RE);
    const text = bullet ? clean(bullet[1]) : clean(line);
    if (!text) continue;

    const timeMatch = line.match(TIME_LABEL_RE);
    if (timeMatch) {
      const value = valueAfterLabel(body, i, timeMatch[1] ?? "");
      estimatedTime = extractDuration(value) || value;
      section = "lessons";
      continue;
    }

    const assessmentMatch = line.match(ASSESSMENT_LABEL_RE);
    if (assessmentMatch) {
      const inline = clean(assessmentMatch[1] ?? "");
      if (inline) {
        assessment = inline;
      } else {
        // The value may be a bullet list under the label.
        const collected: string[] = [];
        for (let j = i + 1; j < body.length; j += 1) {
          const next = body[j].trim();
          if (!next) continue;
          if (HEADING_RE.test(next) || isMetaLabel(next) || LESSON_LABEL_RE.test(next)) break;
          const b = next.match(BULLET_RE);
          if (b) {
            collected.push(clean(b[1]));
          } else {
            collected.push(clean(next));
            break;
          }
        }
        assessment = collected.join(" ");
      }
      section = "assessment";
      continue;
    }

    const summaryMatch = line.match(SUMMARY_LABEL_RE);
    if (summaryMatch) {
      summary = summary || valueAfterLabel(body, i, summaryMatch[1] ?? "");
      section = "lessons";
      continue;
    }

    if (LESSON_LABEL_RE.test(line)) {
      section = "lessons";
      continue;
    }

    if (bullet) {
      if (section === "assessment") {
        assessmentParts.push(text);
      } else {
        const inlineTime = text.match(DURATION_RE);
        if (inlineTime && /\btime\b/i.test(text)) {
          estimatedTime = estimatedTime || inlineTime[1];
          continue;
        }
        lessons.push(text);
      }
      continue;
    }

    if (!summary && !estimatedTime) {
      const inlineTime = text.match(DURATION_RE);
      if (inlineTime) {
        estimatedTime = inlineTime[1];
        continue;
      }
      summary = text;
    }
  }

  if (!assessment && assessmentParts.length) {
    assessment = assessmentParts.join(" ");
  }

  return {
    title,
    summary,
    order,
    estimatedTime: estimatedTime || fallbackTime,
    assessment,
    lessons: lessons.map((t, i) => ({ title: t, order: i })),
  };
}

/**
 * Parse the AI's Markdown course outline into structured records.
 * Deliberately tolerant: the model is free-form, so we key off headings and
 * labels rather than a rigid grammar, and degrade to empty arrays rather than
 * throwing when a section is missing.
 */
export function parseCourseMarkdown(markdown: string): ParsedCourse {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections = splitSections(lines);

  // --- Title.
  // Models frequently use the H1 as a literal label ("# Course Title") and put
  // the real title in the line beneath, often bolded. Treat any such generic
  // label as a placeholder and prefer the following meaningful line.
  const GENERIC_TITLE_LABELS =
    /^(?:course\s*)?(?:title|name|heading)$|^course\s*title:?$|^title:?$/i;

  const firstH1Index = lines.findIndex((l) => /^#\s+(?!#)/.test(l));
  let title = "";

  if (firstH1Index !== -1) {
    const h1Text = clean((lines[firstH1Index].match(/^#\s+(?!#)(.*)$/)?.[1] ?? ""));
    if (h1Text && !GENERIC_TITLE_LABELS.test(h1Text)) {
      title = h1Text;
    } else {
      // The real title may be the next heading ("## Intro to SQL") or the next
      // line of text, often bolded. Prefer the first meaningful line after the
      // label, whichever form it takes.
      for (let j = firstH1Index + 1; j < lines.length; j += 1) {
        const candidate = lines[j].trim();
        if (!candidate) continue;
        if (candidate === "---") break;

        const heading = candidate.match(/^#{1,6}\s+(.*)$/);
        if (heading) {
          const headingText = clean(heading[1]);
          if (headingText && !GENERIC_TITLE_LABELS.test(headingText)) {
            title = headingText.slice(0, 160);
            break;
          }
          continue;
        }

        if (GENERIC_TITLE_LABELS.test(clean(candidate))) continue;
        const cleaned = stripMarkdown(candidate);
        if (cleaned) {
          title = cleaned.slice(0, 160);
          break;
        }
      }
      if (!title && h1Text) title = h1Text;
    }
  }

  if (!title) {
    const labelledIndex = lines.findIndex((l) =>
      /^\**\s*course\s*title\s*\**\s*:/i.test(l),
    );
    if (labelledIndex !== -1) {
      const inline = clean(
        lines[labelledIndex].replace(/^\**\s*course\s*title\s*\**\s*:/i, ""),
      );
      if (inline) {
        title = inline;
      } else {
        for (let j = labelledIndex + 1; j < lines.length; j += 1) {
          const candidate = lines[j].trim();
          if (!candidate) continue;
          if (HEADING_RE.test(candidate)) break;
          const cleaned = stripMarkdown(candidate);
          if (cleaned) {
            title = cleaned.slice(0, 160);
            break;
          }
        }
      }
    }
  }

  if (!title) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || HEADING_RE.test(trimmed)) continue;
      if (/^\**\s*course\s*title\s*\**\s*:?\s*$/i.test(trimmed)) continue;
      const cleaned = stripMarkdown(trimmed);
      if (cleaned) {
        title = cleaned.slice(0, 160);
        break;
      }
    }
  }

  if (!title) title = "Untitled Course";

  // --- Description
  const descSection =
    findSection(sections, /description|overview|about/i) ??
    sections.find((s) => s.level === 0 && s.body.length);
  const description = descSection
    ? paragraphFrom(descSection.body) || stripMarkdown(descSection.body.join(" "))
    : "";

  // --- Audience / prerequisites
  const audienceSection =
    findSection(sections, /audience|prerequisite/i) ??
    findSection(sections, /who\s+this\s+is\s+for/i);
  const audience = audienceSection
    ? paragraphFrom(audienceSection.body) || bulletsFrom(audienceSection.body).join(" ")
    : "";

  // --- Objectives
  const objectivesSection = findSection(sections, /objective|goal|outcome/i);
  const objectives = objectivesSection ? bulletsFrom(objectivesSection.body) : [];

  // --- Modules: find the breakdown container, then the module headings inside it.
  const breakdown =
    findSection(sections, /module\s*breakdown|modules|course\s*outline|curriculum/i) ??
    null;

  const isModuleHeading = (h: string) =>
    /^module\s*\d+/i.test(h) || /^module\s+[ivxlcdm\d]+/i.test(h) || /^\s*\d+\.\s+/i.test(h);

  let moduleSections: { title: string; body: string[] }[] = [];

  if (breakdown) {
    const startIdx = sections.indexOf(breakdown);
    const containerLevel = breakdown.level;

    // Walk forward collecting deeper headings that look like modules, stopping
    // when we return to the breakdown's own level (or shallower).
    const collected: { title: string; body: string[] }[] = [];
    let active: { title: string; body: string[] } | null = null;

    for (let i = startIdx + 1; i < sections.length; i++) {
      const s = sections[i];
      if (s.level <= containerLevel) break;

      if (isModuleHeading(s.heading)) {
        if (active) collected.push(active);
        active = { title: clean(s.heading), body: [...s.body] };
      } else if (active) {
        // A sub-section inside the current module (e.g. "Lesson Topics",
        // "Estimated Time"). Re-emit its heading as a plain labelled line so the
        // field parser downstream can attribute the following content.
        active.body.push(s.heading, ...s.body);
      } else if (s.level === containerLevel + 1) {
        // First child of the breakdown that isn't a "Module N:" heading —
        // treat it as a module anyway rather than dropping the content.
        active = { title: clean(s.heading), body: [...s.body] };
      }
    }
    if (active) collected.push(active);
    moduleSections = collected;
  }

  // Fallback: no breakdown container found — treat every H3 as a module.
  if (moduleSections.length === 0) {
    moduleSections = sections
      .filter((s) => s.level >= 3)
      .map((s) => ({ title: clean(s.heading), body: [...s.body] }));
  }

  // Top-level suggested assessment (applies to the course as a whole).
  const topAssessment = findSection(sections, /^(suggested\s*)?assessment|capstone/i);
  const fallbackAssessment = topAssessment
    ? paragraphFrom(topAssessment.body) || bulletsFrom(topAssessment.body).join(" ")
    : "";
  const fallbackTime = extractDuration(markdown).slice(0, 40);

  const modules = moduleSections.map((m, i) =>
    parseModuleBlock(m.title, m.body, i, i === 0 ? fallbackTime : ""),
  );

  return {
    title,
    description,
    audience,
    objectives,
    modules: modules.map((m) => ({
      ...m,
      assessment: m.assessment || fallbackAssessment,
    })),
  };
}
