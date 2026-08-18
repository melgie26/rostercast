const GSM_BASIC = new Set(("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001bÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà").split(""));
const GSM_EXTENSION = new Set(["^", "{", "}", "\\", "[", "~", "]", "|", "€", "\f"]);

export function classifySmsText(text) {
  let septets = 0;
  const unicodeCharacters = [];
  for (const character of text) {
    if (GSM_BASIC.has(character)) septets += 1;
    else if (GSM_EXTENSION.has(character)) septets += 2;
    else unicodeCharacters.push(character);
  }
  return unicodeCharacters.length
    ? { encoding: "UCS-2", encodedUnits: text.length, unicodeCharacters: [...new Set(unicodeCharacters)] }
    : { encoding: "GSM-7", encodedUnits: septets, unicodeCharacters: [] };
}

