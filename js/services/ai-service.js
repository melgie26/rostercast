export class AnnouncementAiService { async shorten() { throw new Error("shorten() must be implemented"); } }
export class SimulatedAnnouncementAiService extends AnnouncementAiService {
  async shorten({ body, targetCharacters = 160 }) {
    const replacements = [[/\bplease\b/gi, ""], [/\bin order to\b/gi, "to"], [/\bas soon as possible\b/gi, "ASAP"], [/\s+/g, " "]];
    let suggestion = body;
    for (const [pattern, replacement] of replacements) suggestion = suggestion.replace(pattern, replacement).trim();
    if (suggestion.length > targetCharacters) suggestion = `${suggestion.slice(0, Math.max(0, targetCharacters - 1)).trimEnd()}…`;
    return { provider: "simulated", original: body, suggestion, requires_explicit_acceptance: true };
  }
}
